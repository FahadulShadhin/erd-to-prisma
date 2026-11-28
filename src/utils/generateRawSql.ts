import type { Node, Edge } from '@xyflow/react'
import type { Field } from '../types'

function capitalize(s: string) {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

type SqlColumn = {
  name: string
  type: string
  notNull: boolean
  defaultValue?: string
}

type SqlModel = {
  columns: SqlColumn[]
  pkColumn?: string
  uniqueFields: string[]
  indexFields: string[]
  compositeUniques: string[][]
}

function toSqlTypeName(type: string): string {
  switch (type) {
    case 'Int_autoinc':
      return 'SERIAL'
    case 'String_cuid':
    case 'String_uuid':
    case 'String':
      return 'TEXT'
    case 'Int':
      return 'INTEGER'
    case 'Float':
      return 'DOUBLE PRECISION'
    case 'Boolean':
      return 'BOOLEAN'
    case 'DateTime':
      return 'TIMESTAMP(3)'
    case 'Json':
      return 'JSONB'
    case 'Bytes':
      return 'BYTEA'
    default:
      return 'TEXT'
  }
}

export function generateRawSql(nodes: Node[], edges: Edge[]): string {
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const models: Record<string, SqlModel> = {}
  const getModel = (name: string): SqlModel => {
    const key = capitalize(String(name))
    if (!models[key]) {
      models[key] = { columns: [], uniqueFields: [], indexFields: [], compositeUniques: [] }
    }
    return models[key]
  }

  for (const n of nodes) {
    const modelName = capitalize(String(n.data?.name ?? n.id))
    const model = getModel(modelName)
    model.columns = []
    model.uniqueFields = []
    model.indexFields = []
    model.compositeUniques = []
    const fields = (n.data?.fields ?? []) as Field[]
    const columns: SqlColumn[] = []
    let pkColumn: string | undefined
    for (const f of fields) {
      let columnName = String(f.name)
      const sqlType = toSqlTypeName(f.type)
      let notNull = !f.nullable
      let defaultValue: string | undefined
      if (sqlType === 'TIMESTAMP(3)') {
        const normalized = String(f.name).toLowerCase().replace(/[_\s-]+/g, ' ')
        if (/created\s*at|createdat|created_at/.test(normalized)) {
          columnName = 'createdAt'
          notNull = true
          defaultValue = 'now()'
        } else if (/updated\s*at|updatedat|updated_at/.test(normalized)) {
          columnName = 'updatedAt'
          notNull = true
          defaultValue = 'now()'
        }
      }
      if (f.pk) {
        notNull = true
        pkColumn = columnName
      }
      columns.push({ name: columnName, type: sqlType, notNull, defaultValue })
      if (f.pk) continue
      if (f.unique) model.uniqueFields.push(columnName)
      if (f.index) model.indexFields.push(columnName)
    }
    model.columns = columns
    model.pkColumn = pkColumn
    if (n.data?.junctionTable === true) {
      const fkFields = fields.filter((f) => f.fk).map((f) => f.name)
      if (fkFields.length === 2) model.compositeUniques.push(fkFields)
      for (const fk of fkFields) model.indexFields.push(fk)
    }
  }

  const fkConstraints: { table: string; column: string; refTable: string; refColumn: string }[] = []
  for (const e of edges) {
    const src = nodeById[e.source]
    const tgt = nodeById[e.target]
    if (!src || !tgt) continue
    const relationType = (e.data as { relationType?: string })?.relationType ?? 'one-to-many'
    if (relationType !== 'one-to-many') continue
    const srcFields = (src.data?.fields ?? []) as Field[]
    const srcPk = srcFields.find((f) => f.pk)
    const refColumn = srcPk?.name ?? 'id'
    const junctionForeignKeyFields = ((tgt.data?.fields ?? []) as Field[]).filter((f) => f.fk).map((f) => f.name)
    const sourceForeignKeyColumn = junctionForeignKeyFields.includes(refColumn)
      ? refColumn
      : `${String((src.data as { name?: string }).name ?? src.id)}_id`
    const fkColumn = tgt.data?.junctionTable === true ? sourceForeignKeyColumn : `${String((src.data as { name?: string }).name ?? src.id)}_id`
    const refTable = capitalize(String(src.data?.name ?? src.id))
    fkConstraints.push({ table: capitalize(String(tgt.data?.name ?? tgt.id)), column: fkColumn, refTable, refColumn })
  }

  const statements: string[] = []
  for (const modelName of Object.keys(models)) {
    const model = models[modelName]
    const lines = model.columns.map((c) => {
      let line = `  "${c.name}" ${c.type}`
      line += c.notNull ? ' NOT NULL' : ' NULL'
      if (c.defaultValue) line += ` DEFAULT ${c.defaultValue}`
      return line
    })
    if (model.pkColumn) {
      lines.push(`  CONSTRAINT "${modelName}_${model.pkColumn}_pkey" PRIMARY KEY ("${model.pkColumn}")`)
    }
    statements.push(`CREATE TABLE "${modelName}" (\n${lines.join(',\n')}\n);`)

    for (const uniqueField of model.uniqueFields) {
      statements.push(`CREATE UNIQUE INDEX "${modelName}_${uniqueField}_key" ON "${modelName}" ("${uniqueField}");`)
    }
    for (const composite of model.compositeUniques) {
      statements.push(`CREATE UNIQUE INDEX "${modelName}_${composite.join('_')}_key" ON "${modelName}" (${composite.map((c) => `"${c}"`).join(', ')});`)
    }
    for (const indexField of model.indexFields) {
      statements.push(`CREATE INDEX "${modelName}_${indexField}_idx" ON "${modelName}" ("${indexField}");`)
    }
  }

  for (const fk of fkConstraints) {
    statements.push(`ALTER TABLE "${fk.table}" ADD CONSTRAINT "${fk.table}_${fk.column}_fkey" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}" ("${fk.refColumn}");`)
  }

  // const header = `-- Raw SQL generated from/ the ERD\n\n`
  // return header + statements.join('\n\n') + '\n'

  return statements.join('\n\n') + '\n'
}

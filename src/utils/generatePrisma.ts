import type { Node, Edge } from '@xyflow/react'

type Field = {
  name: string
  type: string
  pk?: boolean
  fk?: boolean
  nullable?: boolean
  unique?: boolean
}

function toPrismaType(t: string) {
  const map: Record<string, string> = {
    String: 'String',
    Int: 'Int',
    Float: 'Float',
    Boolean: 'Boolean',
    DateTime: 'DateTime',
    Json: 'Json',
    Bytes: 'Bytes',
    Int_autoinc: 'Int',
    String_cuid: 'String',
    String_uuid: 'String',
  }
  return map[t] ?? t
}

function capitalize(s: string) {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

export function generatePrismaSchema(nodes: Node[], edges: Edge[], datasourceProvider = 'postgresql') {
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]))
  const models: Record<string, { fields: string[]; relationFields: string[] }> = {}

  // Initialize models and fields
  for (const n of nodes) {
    const modelName = capitalize(String(n.data?.name ?? n.id))
    models[modelName] = { fields: [], relationFields: [] }

    const fields = (n.data?.fields ?? []) as Field[]
    for (const f of fields) {
      const prismaType = toPrismaType(f.type)
      let line = `  ${f.name} ${prismaType}${f.nullable ? '?' : ''}`

      if (f.pk) {
        // Choose default based on the explicit field type when possible.
        // Supported PK strategies: Int_autoinc -> autoincrement(),
        // String_cuid -> cuid(), String_uuid -> uuid().
        if (f.type === 'Int_autoinc' || prismaType === 'Int') {
          line += ' @id @default(autoincrement())'
        } else if (f.type === 'String_uuid') {
          line += ' @id @default(uuid())'
        } else if (f.type === 'String_cuid') {
          line += ' @id @default(cuid())'
        } else {
          // Fallback: if Prisma type is Int prefer autoincrement,
          // otherwise use cuid() as a reasonable default.
          if (prismaType === 'Int') {
            line += ' @id @default(autoincrement())'
          } else {
            line += ' @id @default(cuid())'
          }
        }
      }

      if (f.unique && !f.pk) {
        line += ' @unique'
      }

      models[modelName].fields.push(line)
    }
  }

  // Process edges to generate relations
  for (const e of edges) {
    const src = nodeById[e.source]
    const tgt = nodeById[e.target]
    if (!src || !tgt) continue

    const srcModel = capitalize(String(src.data?.name ?? src.id))
    const tgtModel = capitalize(String(tgt.data?.name ?? tgt.id))
    const relationType = (e.data as any)?.relationType ?? 'one-to-many'

    if (relationType === 'one-to-many') {
      // source (one) -> target (many)
      const srcFields = (src.data?.fields ?? []) as Field[]
      const srcPk = srcFields.find((f: Field) => f.pk)
      const srcPkName = srcPk?.name ?? 'id'
      const srcPkType = toPrismaType(srcPk?.type ?? 'Int')

      const fkName = `${String((src.data as any)?.name)}_id`
      models[tgtModel].fields.push(`  ${fkName} ${srcPkType}`)
      models[tgtModel].relationFields.push(`  ${String((src.data as any)?.name)} ${srcModel} @relation(fields: [${fkName}], references: [${srcPkName}])`)
      models[srcModel].relationFields.push(`  ${String((tgt.data as any)?.name)}s ${tgtModel}[]`)
    } else if (relationType === 'one-to-one') {
      const srcFields = (src.data?.fields ?? []) as Field[]
      const srcPk = srcFields.find((f: Field) => f.pk)
      const srcPkName = srcPk?.name ?? 'id'
      const srcPkType = toPrismaType(srcPk?.type ?? 'Int')

      const fkName = `${String((src.data as any)?.name)}_id`
      models[tgtModel].fields.push(`  ${fkName} ${srcPkType} @unique`)
      models[tgtModel].relationFields.push(`  ${String((src.data as any)?.name)} ${srcModel} @relation(fields: [${fkName}], references: [${srcPkName}])`)
      models[srcModel].relationFields.push(`  ${String((tgt.data as any)?.name)} ${tgtModel}?`)
    } else if (relationType === 'many-to-many') {
      models[srcModel].relationFields.push(`  ${String((tgt.data as any)?.name)}s ${tgtModel}[]`)
      models[tgtModel].relationFields.push(`  ${String((src.data as any)?.name)}s ${srcModel}[]`)
    }
  }

  const header = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${datasourceProvider}"
  url      = env("DATABASE_URL")
}

`

  const body = Object.entries(models).map(([name, { fields, relationFields }]) => {
    const all = [...fields, ...relationFields]
    return `model ${name} {
${all.join('\n')}
}
`
  }).join('\n')

  return header + body
}

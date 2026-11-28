import type { Node, Edge } from '@xyflow/react'

type Field = {
  name: string
  type: string
  pk?: boolean
  fk?: boolean
  nullable?: boolean
  unique?: boolean
  index?: boolean
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

function pluralizeRelationName(name: string) {
  if (name.endsWith('s')) return name
  if (/[aeiou]y$/i.test(name)) return `${name}s`
  if (name.endsWith('y')) return `${name.slice(0, -1)}ies`
  return `${name}s`
}

export function generatePrismaSchema(
  nodes: Node[],
  edges: Edge[],
  enums: { name: string; values: string[] }[] = [],
  datasourceProvider = 'postgresql'
) {
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]))
  // Determine which enums are actually referenced by fields in the nodes.
  const referencedEnumNames = new Set<string>()
  for (const n of nodes) {
    const fields = (n.data?.fields ?? []) as Field[]
    for (const f of fields) {
      const prismaType = toPrismaType(f.type)
      if ((enums || []).some((e) => e.name === prismaType)) referencedEnumNames.add(prismaType)
    }
  }

  // Only include enums that are referenced somewhere to keep schema minimal
  const filteredEnums = (enums || []).filter((e) => referencedEnumNames.has(e.name))
  const enumsMap: Record<string, string[]> = Object.fromEntries(filteredEnums.map(e => [e.name, e.values]))
  const models: Record<string, { fields: string[]; relationFields: string[]; constraints: string[] }> = {}

  // Initialize models and fields
  for (const n of nodes) {
    const modelName = capitalize(String(n.data?.name ?? n.id))
    models[modelName] = { fields: [], relationFields: [], constraints: [] }

    const fields = (n.data?.fields ?? []) as Field[]
    for (const f of fields) {
      const prismaType = toPrismaType(f.type)
      // normalize name and build default line
      const normalized = String(f.name).toLowerCase().replace(/[_\s-]+/g, ' ')
      let line = `  ${f.name} ${prismaType}${f.nullable ? '?' : ''}`

      // Special handling for common timestamp fields: createdAt / updatedAt
      // If the field is a DateTime and its name looks like "created at" or
      // "updated at" (including variants with underscores/dashes), emit a
      // standardized Prisma field: `createdAt DateTime? @default(now())` or
      // `updatedAt DateTime? @default(now()) @updatedAt` and skip other
      // modifiers.
      if (prismaType === 'DateTime') {
        if (/created\s*at|createdat|created_at/.test(normalized)) {
          line = `  createdAt DateTime? @default(now())`
          models[modelName].fields.push(line)
          continue
        }

        if (/updated\s*at|updatedat|updated_at/.test(normalized)) {
          line = `  updatedAt DateTime? @default(now()) @updatedAt`
          models[modelName].fields.push(line)
          continue
        }
      }

      if (f.pk) {
        // Only emit defaults when the user explicitly chose a PK strategy.
        // - Int_autoinc -> autoincrement()
        // - String_cuid -> cuid()
        // - String_uuid -> uuid()
        // If the user chose a plain base type (e.g. `Int` or `String`) as
        // the PK, we just emit `@id` without a default so the choice is
        // explicit and predictable.
        if (f.type === 'Int_autoinc') {
          line += ' @id @default(autoincrement())'
        } else if (f.type === 'String_uuid') {
          line += ' @id @default(uuid())'
        } else if (f.type === 'String_cuid') {
          line += ' @id @default(cuid())'
        } else {
          line += ' @id'
        }
      }

        // If this field's type is an enum we know about, and we didn't already
        // add a @default (e.g., from PK strategy), set the default to the
        // first enum value so generated schema has a sensible default.
        if (enumsMap[prismaType] && enumsMap[prismaType].length > 0 && !line.includes('@default(')) {
          const first = enumsMap[prismaType][0]
          if (first) {
            line += ` @default(${first})`
          }
        }

      if (f.unique && !f.pk) {
        line += ' @unique'
      }

      // Index handling follows index design best practices:
      // - A primary key already implies a unique index (emitted via `@id`),
      //   so we never stack an extra `@@index` on primary keys.
      // - A unique column already carries a unique index, so an additional
      //   regular index would be redundant (over-indexing / duplicate).
      // - Otherwise, an explicit per-field index is emitted as an `@@index`.
      if (f.index && !f.pk && !f.unique && f.name.trim()) {
        const indexLine = `  @@index([${f.name}])`
        if (!models[modelName].constraints.includes(indexLine)) {
          models[modelName].constraints.push(indexLine)
        }
      }

      models[modelName].fields.push(line)
    }

    if (n.data?.junctionTable === true) {
      const foreignKeyFields = fields.filter((field) => field.fk).map((field) => field.name)
      if (foreignKeyFields.length === 2) {
        models[modelName].constraints.push(`  @@unique([${foreignKeyFields.join(', ')}])`)
        // Index design best practice: index the junction foreign keys so
        // lookups joining through the junction are seek operations.
        for (const fk of foreignKeyFields) {
          const indexLine = `  @@index([${fk}])`
          if (!models[modelName].constraints.includes(indexLine)) {
            models[modelName].constraints.push(indexLine)
          }
        }
      }
    }
  }

  const hasModelField = (modelName: string, fieldName: string) =>
    models[modelName].fields.some((field) => field.trimStart().startsWith(`${fieldName} `))

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
      if (tgt.data?.junctionTable === true) {
        // Junction tables already declare their foreign keys as actual primary
        // key fields on the junction node, so wire the relation without pushing
        // a duplicate foreign key field (e.g. avoid "product_id" next to the real
        // primary key based FK like "code").
        const junctionForeignKeyFields = ((tgt.data?.fields ?? []) as Field[]).filter((f) => f.fk).map((f) => f.name)
        // When both tables share the same primary key name (e.g. both default to
        // "id"), the junction foreign keys cannot reuse that shared name twice, so
        // only append "<table name>_id" to the junction table reference.
        const sourceForeignKeyName = junctionForeignKeyFields.includes(srcPkName)
          ? srcPkName
          : `${String((src.data as { name?: string })?.name ?? src.id)}_id`
        models[tgtModel].relationFields.push(`  ${String((src.data as { name?: string })?.name)} ${srcModel} @relation(fields: [${sourceForeignKeyName}], references: [${srcPkName}])`)
        models[srcModel].relationFields.push(`  ${pluralizeRelationName(String((tgt.data as any)?.name))} ${tgtModel}[]`)
      } else {
        if (!hasModelField(tgtModel, fkName)) {
          models[tgtModel].fields.push(`  ${fkName} ${srcPkType}`)
          const fkIndexLine = `  @@index([${fkName}])`
          if (!models[tgtModel].constraints.includes(fkIndexLine)) {
            models[tgtModel].constraints.push(fkIndexLine)
          }
        }
        models[tgtModel].relationFields.push(`  ${String((src.data as any)?.name)} ${srcModel} @relation(fields: [${fkName}], references: [${srcPkName}])`)
        models[srcModel].relationFields.push(`  ${pluralizeRelationName(String((tgt.data as any)?.name))} ${tgtModel}[]`)
      }
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

  const enumBlocks = filteredEnums
    .map((e) => `enum ${e.name} {
${e.values.map((v) => `  ${v}`).join('\n')}
}
`)
    .join('\n')

  // Ensure there's an extra blank line after enums so models are separated
  const enumSection = enumBlocks ? enumBlocks + '\n' : ''

  const body = Object.entries(models).map(([name, { fields, relationFields, constraints }]) => {
    const all = [...fields, ...relationFields, ...constraints]
    return `model ${name} {
${all.join('\n')}
}
`
  }).join('\n')

  return header + enumSection + body
}

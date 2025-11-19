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

export function generatePrismaSchema(
  nodes: Node[],
  edges: Edge[],
  enums: { name: string; values: string[] }[] = [],
  datasourceProvider = 'postgresql'
) {
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]))
  const enumsMap: Record<string, string[]> = Object.fromEntries((enums || []).map(e => [e.name, e.values]))
  const models: Record<string, { fields: string[]; relationFields: string[] }> = {}

  // Initialize models and fields
  for (const n of nodes) {
    const modelName = capitalize(String(n.data?.name ?? n.id))
    models[modelName] = { fields: [], relationFields: [] }

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

  const enumBlocks = (enums || [])
    .map((e) => `enum ${e.name} {
${e.values.map((v) => `  ${v}`).join('\n')}
}
`)
    .join('\n')

  // Ensure there's an extra blank line after enums so models are separated
  const enumSection = enumBlocks ? enumBlocks + '\n' : ''

  const body = Object.entries(models).map(([name, { fields, relationFields }]) => {
    const all = [...fields, ...relationFields]
    return `model ${name} {
${all.join('\n')}
}
`
  }).join('\n')

  return header + enumSection + body
}

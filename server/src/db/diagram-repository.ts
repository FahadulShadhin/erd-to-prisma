import type { QueryResultRow } from 'pg'
import { persistedDiagramSchema } from '../diagram-validation.js'
import { pool } from './pool.js'

export interface DiagramData {
  id: string
  name: string
  updatedAt: string
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
  enums: { name: string; values: string[] }[]
}

export interface VersionedDiagram {
  diagram: DiagramData
  version: number
}

interface DiagramRow extends QueryResultRow {
  id: string
  name: string
  updatedAt: Date
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
  enums: { name: string; values: string[] }[]
  version: number
}

function mapDiagramRow(row: DiagramRow): VersionedDiagram {
  const validatedRow = persistedDiagramSchema.parse(row)
  return {
    diagram: {
      id: validatedRow.id,
      name: validatedRow.name,
      updatedAt: validatedRow.updatedAt.toISOString(),
      nodes: validatedRow.nodes,
      edges: validatedRow.edges,
      enums: validatedRow.enums,
    },
    version: validatedRow.version,
  }
}

const diagramColumns = `id, name, updated_at AS "updatedAt", nodes, edges, enums, version`

export async function listDiagrams(ownerId: string): Promise<VersionedDiagram[]> {
  const result = await pool.query<DiagramRow>(
    `SELECT ${diagramColumns}
     FROM diagrams
     WHERE owner_id = $1
     ORDER BY updated_at DESC, id`,
    [ownerId],
  )

  return result.rows.map(mapDiagramRow)
}

export async function createDiagram(
  ownerId: string,
  diagram: Pick<DiagramData, 'id' | 'name' | 'nodes' | 'edges' | 'enums'>,
): Promise<VersionedDiagram> {
  const result = await pool.query<DiagramRow>(
    `INSERT INTO diagrams (id, owner_id, name, nodes, edges, enums)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
     RETURNING ${diagramColumns}`,
    [
      diagram.id,
      ownerId,
      diagram.name,
      JSON.stringify(diagram.nodes),
      JSON.stringify(diagram.edges),
      JSON.stringify(diagram.enums),
    ],
  )
  const row = result.rows[0]
  if (!row) throw new Error('Unable to load the created diagram.')
  return mapDiagramRow(row)
}

export async function updateDiagram(
  ownerId: string,
  id: string,
  version: number,
  diagram: Pick<DiagramData, 'name' | 'nodes' | 'edges' | 'enums'>,
): Promise<VersionedDiagram | null> {
  const result = await pool.query<DiagramRow>(
    `UPDATE diagrams
     SET name = $4, nodes = $5::jsonb, edges = $6::jsonb, enums = $7::jsonb,
         updated_at = now(), version = version + 1
     WHERE id = $1 AND owner_id = $2 AND version = $3
     RETURNING ${diagramColumns}`,
    [
      id,
      ownerId,
      version,
      diagram.name,
      JSON.stringify(diagram.nodes),
      JSON.stringify(diagram.edges),
      JSON.stringify(diagram.enums),
    ],
  )
  const row = result.rows[0]
  return row ? mapDiagramRow(row) : null
}

export async function findDiagramVersion(ownerId: string, id: string): Promise<number | null> {
  const result = await pool.query<{ version: number }>(
    'SELECT version FROM diagrams WHERE id = $1 AND owner_id = $2',
    [id, ownerId],
  )
  return result.rows[0]?.version ?? null
}

export async function deleteDiagram(
  ownerId: string,
  id: string,
  version: number,
): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM diagrams WHERE id = $1 AND owner_id = $2 AND version = $3',
    [id, ownerId, version],
  )
  return result.rowCount === 1
}

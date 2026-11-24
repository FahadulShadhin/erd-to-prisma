import type { Edge, Node } from '@xyflow/react'

export interface DiagramData {
  id: string
  name: string
  updatedAt: string
  nodes: Node[]
  edges: Edge[]
  enums: { name: string; values: string[] }[]
}

export interface VersionedDiagram {
  diagram: DiagramData
  version: number
}

export interface DiagramCache {
  diagrams: VersionedDiagram[]
  activeDiagramId: string
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
const diagramCachePrefix = 'erd-to-prisma:diagrams:'
const legacyDiagramsKey = 'erd-to-prisma:diagrams'
const legacyFlowKey = 'erd-to-prisma:flow'

export class DiagramApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'DiagramApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDiagramData(value: unknown): value is DiagramData {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.updatedAt === 'string'
    && Array.isArray(value.nodes)
    && Array.isArray(value.edges)
    && Array.isArray(value.enums)
}

function isVersionedDiagram(value: unknown): value is VersionedDiagram {
  return isRecord(value)
    && isDiagramData(value.diagram)
    && typeof value.version === 'number'
    && Number.isSafeInteger(value.version)
    && value.version > 0
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = 'The diagram service could not complete the request.'
    try {
      const body: unknown = await response.json()
      if (isRecord(body) && typeof body.error === 'string') message = body.error
    } catch {
      // Keep the generic message when the server does not return JSON.
    }
    throw new DiagramApiError(message, response.status)
  }
  return response
}

export async function fetchDiagrams(): Promise<VersionedDiagram[]> {
  const response = await request('/api/diagrams')
  const result: unknown = await response.json()
  if (!isRecord(result) || !Array.isArray(result.diagrams) || !result.diagrams.every(isVersionedDiagram)) {
    throw new Error('The diagram service returned invalid diagram data.')
  }
  return result.diagrams
}

export async function createCloudDiagram(diagram: DiagramData): Promise<VersionedDiagram> {
  const response = await request('/api/diagrams', {
    method: 'POST',
    body: JSON.stringify({
      id: diagram.id,
      name: diagram.name,
      nodes: diagram.nodes,
      edges: diagram.edges,
      enums: diagram.enums,
    }),
  })
  const result: unknown = await response.json()
  if (!isVersionedDiagram(result)) throw new Error('The diagram service returned invalid diagram data.')
  return result
}

export async function updateCloudDiagram(
  diagram: DiagramData,
  version: number,
): Promise<VersionedDiagram> {
  const response = await request(`/api/diagrams/${encodeURIComponent(diagram.id)}`, {
    method: 'PUT',
    headers: { 'If-Match': String(version) },
    body: JSON.stringify({
      name: diagram.name,
      nodes: diagram.nodes,
      edges: diagram.edges,
      enums: diagram.enums,
    }),
  })
  const result: unknown = await response.json()
  if (!isVersionedDiagram(result)) throw new Error('The diagram service returned invalid diagram data.')
  return result
}

export async function deleteCloudDiagram(id: string, version: number): Promise<void> {
  await request(`/api/diagrams/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'If-Match': String(version) },
  })
}

function cacheKey(userId: string): string {
  return `${diagramCachePrefix}${userId}`
}

export function readDiagramCache(userId: string): DiagramCache | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (
      !isRecord(value)
      || !Array.isArray(value.diagrams)
      || !value.diagrams.every(isVersionedDiagram)
      || typeof value.activeDiagramId !== 'string'
    ) {
      console.error('Unable to load the cached ERD diagrams: the saved data is invalid.')
      return null
    }
    return { diagrams: value.diagrams, activeDiagramId: value.activeDiagramId }
  } catch (error) {
    console.error('Unable to read cached ERD diagrams from browser storage.', error)
    return null
  }
}

export function saveDiagramCache(userId: string, cache: DiagramCache): void {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(cache))
  } catch (error) {
    console.error('Unable to cache ERD diagrams in browser storage.', error)
  }
}

export function readLocalImportCandidates(): DiagramData[] {
  try {
    const raw = localStorage.getItem(legacyDiagramsKey)
    if (raw) {
      const saved: unknown = JSON.parse(raw)
      const candidates = Array.isArray(saved)
        ? saved
        : isRecord(saved) && Array.isArray(saved.diagrams) ? saved.diagrams : []
      if (candidates.length > 0 && candidates.every(isDiagramData)) return candidates
    }

    const legacyFlow = localStorage.getItem(legacyFlowKey)
    if (legacyFlow) {
      const flow: unknown = JSON.parse(legacyFlow)
      if (isRecord(flow) && Array.isArray(flow.nodes) && Array.isArray(flow.edges) && Array.isArray(flow.enums)) {
        return [{
          id: crypto.randomUUID(),
          name: 'Diagram 1',
          updatedAt: new Date().toISOString(),
          nodes: flow.nodes as Node[],
          edges: flow.edges as Edge[],
          enums: flow.enums as DiagramData['enums'],
        }]
      }
    }
  } catch (error) {
    console.error('Unable to read local ERD diagrams for import.', error)
  }
  return []
}

export function hasSkippedLocalImport(userId: string): boolean {
  try {
    return localStorage.getItem(`${cacheKey(userId)}:import-skipped`) === 'true'
  } catch (error) {
    console.error('Unable to read local diagram import preference.', error)
    return false
  }
}

export function markLocalImportSkipped(userId: string): void {
  try {
    localStorage.setItem(`${cacheKey(userId)}:import-skipped`, 'true')
  } catch (error) {
    console.error('Unable to save local diagram import preference.', error)
  }
}

export function readImportedLocalDiagramIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${cacheKey(userId)}:imported`)
    if (!raw) return new Set()
    const value: unknown = JSON.parse(raw)
    if (Array.isArray(value) && value.every((id) => typeof id === 'string')) return new Set(value)
    console.error('Unable to load the local diagram import history: the saved data is invalid.')
  } catch (error) {
    console.error('Unable to read local diagram import history.', error)
  }
  return new Set()
}

export function markLocalDiagramsImported(userId: string, ids: string[]): void {
  try {
    const importedIds = readImportedLocalDiagramIds(userId)
    ids.forEach((id) => importedIds.add(id))
    localStorage.setItem(`${cacheKey(userId)}:imported`, JSON.stringify([...importedIds]))
  } catch (error) {
    console.error('Unable to save local diagram import history.', error)
  }
}

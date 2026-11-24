import { Router, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createDiagramSchema, diagramContentSchema } from '../diagram-validation.js'
import {
  createDiagram,
  deleteDiagram,
  findDiagramVersion,
  listDiagrams,
  updateDiagram,
} from '../db/diagram-repository.js'
import type { DiagramData } from '../db/diagram-repository.js'
import { config } from '../config.js'

const router = Router()

const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
})

function requireUser(request: Request, response: Response): string | null {
  if (!request.user) {
    response.status(401).json({ error: 'Authentication required.' })
    return null
  }
  return request.user.id
}

function requireSameOrigin(
  request: Request,
  response: Response,
): boolean {
  if (request.get('origin') !== config.APP_ORIGIN) {
    response.status(403).json({ error: 'Request origin not allowed.' })
    return false
  }
  return true
}

function parseVersion(request: Request): number | null {
  const header = request.get('if-match')
  if (!header || !/^\d+$/.test(header)) return null
  const version = Number(header)
  return Number.isSafeInteger(version) && version > 0 ? version : null
}

router.get('/api/diagrams', async (request, response, next) => {
  const ownerId = requireUser(request, response)
  if (!ownerId) return

  try {
    response.setHeader('Cache-Control', 'no-store')
    response.json({ diagrams: await listDiagrams(ownerId) })
  } catch (error) {
    next(error)
  }
})

router.post('/api/diagrams', writeRateLimit, async (request, response, next) => {
  if (!requireSameOrigin(request, response)) return
  const ownerId = requireUser(request, response)
  if (!ownerId) return

  const parsed = createDiagramSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid diagram data.' })
    return
  }

  try {
    const diagram: DiagramData = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    }
    const created = await createDiagram(ownerId, diagram)
    response.status(201).json(created)
  } catch (error) {
    if (isUniqueViolation(error)) {
      response.status(409).json({ error: 'A diagram with this ID already exists.' })
      return
    }
    next(error)
  }
})

router.put('/api/diagrams/:id', writeRateLimit, async (request, response, next) => {
  if (!requireSameOrigin(request, response)) return
  const ownerId = requireUser(request, response)
  if (!ownerId) return
  const id = createDiagramSchema.shape.id.safeParse(request.params.id)
  const version = parseVersion(request)
  const parsed = diagramContentSchema.safeParse(request.body)
  if (!id.success || !parsed.success || version === null) {
    response.status(400).json({ error: 'Invalid diagram data or version.' })
    return
  }

  try {
    const updated = await updateDiagram(ownerId, id.data, version, parsed.data)
    if (updated) {
      response.json(updated)
      return
    }

    const currentVersion = await findDiagramVersion(ownerId, id.data)
    if (currentVersion === null) {
      response.status(404).json({ error: 'Diagram not found.' })
      return
    }
    response.status(409).json({ error: 'The diagram changed elsewhere. Reload it before saving.' })
  } catch (error) {
    next(error)
  }
})

router.delete('/api/diagrams/:id', writeRateLimit, async (request, response, next) => {
  if (!requireSameOrigin(request, response)) return
  const ownerId = requireUser(request, response)
  if (!ownerId) return
  const id = createDiagramSchema.shape.id.safeParse(request.params.id)
  const version = parseVersion(request)
  if (!id.success || version === null) {
    response.status(400).json({ error: 'Invalid diagram ID or version.' })
    return
  }

  try {
    if (await deleteDiagram(ownerId, id.data, version)) {
      response.status(204).end()
      return
    }
    const currentVersion = await findDiagramVersion(ownerId, id.data)
    if (currentVersion === null) {
      response.status(404).json({ error: 'Diagram not found.' })
      return
    }
    response.status(409).json({ error: 'The diagram changed elsewhere. Reload it before deleting.' })
  } catch (error) {
    next(error)
  }
})

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

export { router as diagramRouter }

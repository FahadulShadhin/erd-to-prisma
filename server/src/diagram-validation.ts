import { z } from 'zod'

const uuidSchema = z.string().uuid()
const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).passthrough(),
  data: z.record(z.string(), z.unknown()),
}).passthrough()
const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  type: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}).passthrough()
const enumSchema = z.object({
  name: z.string().min(1).max(100),
  values: z.array(z.string().min(1).max(100)).max(500),
}).strict()

export const diagramContentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  nodes: z.array(nodeSchema).max(5000),
  edges: z.array(edgeSchema).max(10000),
  enums: z.array(enumSchema).max(500),
}).strict()

export const createDiagramSchema = diagramContentSchema.extend({ id: uuidSchema }).strict()

export const persistedDiagramSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  updatedAt: z.date(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  enums: z.array(enumSchema),
  version: z.number().int().positive(),
})

import 'dotenv/config'
import { z } from 'zod'

const originSchema = z
  .string()
  .url()
  .refine((value) => {
    const parsed = new URL(value)
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.origin === value.replace(/\/$/, '')
    )
  }, 'Must be an HTTP(S) origin without a path')
  .transform((value) => new URL(value).origin)

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  APP_ORIGIN: originSchema,
  API_ORIGIN: originSchema,
})

const environment = environmentSchema.safeParse(process.env)

if (!environment.success) {
  const variableNames = [
    ...new Set(
      environment.error.issues.flatMap(({ path }) => (typeof path[0] === 'string' ? [path[0]] : [])),
    ),
  ]
  throw new Error(`Missing or invalid server environment variables: ${variableNames.join(', ')}`)
}

export const config = environment.data

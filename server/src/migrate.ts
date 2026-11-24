import { readFile } from 'node:fs/promises'
import type { PoolClient } from 'pg'
import { pool } from './db/pool.js'

const migrations = [
  { name: '001_github_auth', path: new URL('../migrations/001_github_auth.sql', import.meta.url) },
  { name: '002_diagrams', path: new URL('../migrations/002_diagrams.sql', import.meta.url) },
]
const migrationLockId = 638_421_907

async function runMigration(): Promise<void> {
  const client = await pool.connect()
  let transactionStarted = false

  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    )
    await client.query('BEGIN')
    transactionStarted = true
    await client.query('SELECT pg_advisory_xact_lock($1)', [migrationLockId])

    for (const migration of migrations) {
      const existing = await client.query<{ name: string }>(
        'SELECT name FROM schema_migrations WHERE name = $1',
        [migration.name],
      )

      if (existing.rows.length === 0) {
        const migrationSql = await readFile(migration.path, 'utf8')
        await client.query(migrationSql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name])
      }
    }

    await client.query('COMMIT')
    transactionStarted = false
  } catch (error) {
    if (transactionStarted) {
      await rollbackMigration(client, error)
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

async function rollbackMigration(client: PoolClient, originalError: unknown): Promise<never> {
  try {
    await client.query('ROLLBACK')
  } catch (rollbackError) {
    throw new AggregateError(
      [originalError, rollbackError],
      'Migration failed and rollback could not complete.',
    )
  }
  throw originalError
}

void runMigration()
  .then(() => {
    console.info('Database migrations are up to date.')
  })
  .catch((error: unknown) => {
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    console.error(
      `Database migration failed (${errorName}). Check the server configuration and database availability.`,
    )
    process.exitCode = 1
  })

import { app } from './app.js'
import { config } from './config.js'
import { pool } from './db/pool.js'

async function startServer(): Promise<void> {
  try {
    await pool.query('SELECT 1')
  } catch {
    console.error('Unable to connect to PostgreSQL. Verify the server database configuration.')
    await pool.end()
    process.exitCode = 1
    return
  }

  const server = app.listen(config.PORT, () => {
    console.info(`ERD to Prisma API listening on port ${config.PORT}.`)
  })

  const shutdown = () => {
    server.close(() => {
      void pool.end()
    })
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

void startServer()

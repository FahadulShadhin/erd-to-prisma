import connectPgSimple from 'connect-pg-simple'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import helmet from 'helmet'
import { passport } from './auth/passport.js'
import { config } from './config.js'
import { pool } from './db/pool.js'
import { authRouter } from './routes/auth-routes.js'

const sessionCookieName = 'erd_to_prisma.sid'
const PostgreSqlSessionStore = connectPgSimple(session)
const app = express()

app.disable('x-powered-by')
app.set('trust proxy', config.NODE_ENV === 'production' ? 1 : false)
app.use(helmet())
app.use(
  cors({
    origin: config.APP_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(
  session({
    name: sessionCookieName,
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PostgreSqlSessionStore({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: false,
    }),
    cookie: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
)
app.use(passport.initialize())
app.use(passport.session())

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
})

app.get('/healthz', apiRateLimit, async (_request, response) => {
  await pool.query('SELECT 1')
  response.json({ status: 'ok' })
})

app.use(authRouter)

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found.' })
})

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError'
  console.error(`Unhandled API error (${errorName}).`)
  if (response.headersSent) {
    next(error)
    return
  }
  response.status(500).json({ error: 'Internal server error.' })
}

app.use(errorHandler)

export { app }

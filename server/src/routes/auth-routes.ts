import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { config } from '../config.js'
import { passport } from '../auth/passport.js'

const router = Router()
const githubLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
})
const failedGitHubLoginUrl = new URL('/?auth=github-failed', config.APP_ORIGIN).toString()
const sessionCookieName = 'erd_to_prisma.sid'

router.get('/auth/github', githubLoginLimiter, passport.authenticate('github'))

router.get(
  '/auth/github/callback',
  githubLoginLimiter,
  passport.authenticate('github', { failureRedirect: failedGitHubLoginUrl }),
  (_request, response) => {
    response.redirect(config.APP_ORIGIN)
  },
)

router.get('/api/auth/me', (request, response) => {
  const user = request.user
  response.setHeader('Cache-Control', 'no-store')
  response.json({
    user: user
      ? {
          id: user.id,
          displayName: user.displayName,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }
      : null,
  })
})

router.post('/api/auth/logout', (request, response, next) => {
  if (request.get('origin') !== config.APP_ORIGIN) {
    response.status(403).json({ error: 'Request origin not allowed.' })
    return
  }

  request.logout((logoutError) => {
    if (logoutError) {
      next(logoutError)
      return
    }

    request.session.destroy((sessionError) => {
      if (sessionError) {
        next(sessionError)
        return
      }

      response.clearCookie(sessionCookieName, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/',
      })
      response.status(204).end()
    })
  })
})

export { router as authRouter }

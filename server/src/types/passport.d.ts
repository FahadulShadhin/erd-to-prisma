declare global {
  namespace Express {
    interface User {
      id: string
      displayName: string
      username: string | null
      email: string | null
      avatarUrl: string | null
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    githubOAuthState?: string
  }
}

export {}

export interface AuthUser {
  id: string
  displayName: string
  username: string | null
  email: string | null
  avatarUrl: string | null
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.displayName === 'string' &&
    (typeof value.username === 'string' || value.username === null) &&
    (typeof value.email === 'string' || value.email === null) &&
    (typeof value.avatarUrl === 'string' || value.avatarUrl === null)
  )
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Unable to check the login session.')
  }

  const result: unknown = await response.json()
  if (!isRecord(result) || !('user' in result)) {
    throw new Error('The login service returned an invalid response.')
  }
  if (result.user === null) return null
  if (!isAuthUser(result.user)) {
    throw new Error('The login service returned an invalid user.')
  }

  return result.user
}

export function getGitHubLoginUrl(): string {
  return `${apiBaseUrl}/auth/github`
}

export async function logOut(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Unable to sign out. Please try again.')
  }
}

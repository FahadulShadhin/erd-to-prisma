import { useEffect, useState } from 'react'
import { getGitHubLoginUrl, logOut, type AuthUser } from '../services/auth-api'

type AuthControlProps = {
  status: 'loading' | 'signed-out' | 'signed-in' | 'error'
  user: AuthUser | null
  error?: string
  onRetry: () => void
  onSignedOut: () => void
}

function readGitHubLoginError(): boolean {
  const url = new URL(window.location.href)
  const failed = url.searchParams.get('auth') === 'github-failed'

  if (url.searchParams.has('auth')) {
    url.searchParams.delete('auth')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  return failed
}

export default function AuthControl({ status, user, error, onRetry, onSignedOut }: AuthControlProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [signInFailed, setSignInFailed] = useState(false)

  useEffect(() => {
    setSignInFailed(readGitHubLoginError())
  }, [])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setSignOutError(null)
    try {
      await logOut()
      onSignedOut()
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Unable to sign out.')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <section className="account-panel" aria-label="Account">
      {status === 'loading' ? (
        <p className="account-status" role="status">
          Checking account…
        </p>
      ) : status === 'signed-in' && user ? (
        <>
          <div className="account-identity">
            {user.avatarUrl ? (
              <img className="account-avatar" src={user.avatarUrl} alt="" />
            ) : (
              <span className="account-avatar account-avatar-fallback" aria-hidden="true">
                GH
              </span>
            )}
            <div className="account-user-details">
              <strong>{user.displayName}</strong>
              {user.username && <span>@{user.username}</span>}
            </div>
          </div>
          {signOutError && (
            <p className="account-error" role="alert">
              {signOutError}
            </p>
          )}
          <button
            className="account-secondary-button"
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </>
      ) : (
        <>
          <div className="account-heading">
            <strong>Save your diagrams</strong>
            <span>{status === 'error' ? error : 'Sign in to your account'}</span>
          </div>
          {status === 'signed-out' && signInFailed && (
            <p className="account-error" role="alert">
            GitHub sign-in failed. Please try again.
            </p>
          )}
          <button
            className="github-login-button"
            type="button"
            onClick={() => window.location.assign(getGitHubLoginUrl())}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.7 1.15 1.7 1.15.99 1.69 2.58 1.2 3.21.92.1-.72.39-1.2.7-1.48-2.48-.28-5.09-1.24-5.09-5.53 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.3-2.61 5.25-5.1 5.52.4.35.75 1.02.75 2.06v3.08c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" />
            </svg>
            Continue with GitHub
          </button>
          {status === 'error' && (
            <button
              className="account-retry-button"
              type="button"
              onClick={onRetry}
            >
              Retry connection
            </button>
          )}
        </>
      )}
    </section>
  )
}

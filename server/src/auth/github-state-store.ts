import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'

interface OAuthMetadata {
  authorizationURL: string
  tokenURL: string
  clientID: string
}

type StoreCallback = (error: Error | null, state?: string) => void
type VerifyCallback = (error: Error | null, valid: boolean, state?: string) => void

interface StateStore {
  store(request: Request, callback: StoreCallback): void
  store(request: Request, metadata: OAuthMetadata, callback: StoreCallback): void
  verify(request: Request, state: string, callback: VerifyCallback): void
  verify(request: Request, state: string, metadata: OAuthMetadata, callback: VerifyCallback): void
}

function storeState(request: Request, callback: StoreCallback): void
function storeState(request: Request, metadata: OAuthMetadata, callback: StoreCallback): void
function storeState(
  request: Request,
  metadataOrCallback: OAuthMetadata | StoreCallback,
  callback?: StoreCallback,
): void {
  const done = typeof metadataOrCallback === 'function' ? metadataOrCallback : callback
  if (!done) throw new Error('GitHub OAuth state callback is missing.')

  const state = randomBytes(32).toString('base64url')
  request.session.githubOAuthState = state
  request.session.save((error) => done(error, error ? undefined : state))
}

function verifyState(request: Request, state: string, callback: VerifyCallback): void
function verifyState(request: Request, state: string, metadata: OAuthMetadata, callback: VerifyCallback): void
function verifyState(
  request: Request,
  state: string,
  metadataOrCallback: OAuthMetadata | VerifyCallback,
  callback?: VerifyCallback,
): void {
  const done = typeof metadataOrCallback === 'function' ? metadataOrCallback : callback
  if (!done) throw new Error('GitHub OAuth verification callback is missing.')

  const expectedState = request.session.githubOAuthState
  delete request.session.githubOAuthState

  const stateBytes = typeof state === 'string' ? Buffer.from(state) : Buffer.alloc(0)
  const expectedStateBytes = typeof expectedState === 'string' ? Buffer.from(expectedState) : Buffer.alloc(0)
  const stateMatches =
    typeof state === 'string' &&
    typeof expectedState === 'string' &&
    stateBytes.length === expectedStateBytes.length &&
    timingSafeEqual(stateBytes, expectedStateBytes)

  request.session.save((error) => {
    if (error) {
      done(error, false)
      return
    }
    done(null, stateMatches)
  })
}

export const githubStateStore: StateStore = {
  store: storeState,
  verify: verifyState,
}

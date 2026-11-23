import { randomUUID } from 'node:crypto'
import type { QueryResultRow } from 'pg'
import type { AuthUser, GitHubProfileData } from '../auth/auth-user.js'
import { pool } from './pool.js'

interface UserIdRow extends QueryResultRow {
  userId: string
}

interface AuthUserRow extends QueryResultRow {
  id: string
  displayName: string
  username: string | null
  email: string | null
  avatarUrl: string | null
}

const githubProvider = 'github'

export async function upsertGitHubUser(profile: GitHubProfileData): Promise<AuthUser> {
  const client = await pool.connect()
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    const existingAccount = await client.query<UserIdRow>(
      `SELECT user_id AS "userId"
       FROM oauth_accounts
       WHERE provider = $1 AND provider_user_id = $2
       FOR UPDATE`,
      [githubProvider, profile.providerUserId],
    )

    let userId = existingAccount.rows[0]?.userId

    if (!userId) {
      const newUserId = randomUUID()
      await client.query('INSERT INTO users (id) VALUES ($1)', [newUserId])

      const insertedAccount = await client.query<UserIdRow>(
        `INSERT INTO oauth_accounts (
           id, user_id, provider, provider_user_id, username, display_name, email, avatar_url
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (provider, provider_user_id) DO NOTHING
         RETURNING user_id AS "userId"`,
        [
          randomUUID(),
          newUserId,
          githubProvider,
          profile.providerUserId,
          profile.username,
          profile.displayName,
          profile.email,
          profile.avatarUrl,
        ],
      )

      userId = insertedAccount.rows[0]?.userId

      if (!userId) {
        await client.query('DELETE FROM users WHERE id = $1', [newUserId])
        const concurrentAccount = await client.query<UserIdRow>(
          `SELECT user_id AS "userId"
           FROM oauth_accounts
           WHERE provider = $1 AND provider_user_id = $2
           FOR UPDATE`,
          [githubProvider, profile.providerUserId],
        )
        userId = concurrentAccount.rows[0]?.userId
      }

      if (!userId) {
        throw new Error('Unable to resolve the GitHub account after insert.')
      }
    }

    await client.query(
      `UPDATE oauth_accounts
       SET username = $1, display_name = $2, email = $3, avatar_url = $4, updated_at = now()
       WHERE provider = $5 AND provider_user_id = $6`,
      [
        profile.username,
        profile.displayName,
        profile.email,
        profile.avatarUrl,
        githubProvider,
        profile.providerUserId,
      ],
    )

    const result = await client.query<AuthUserRow>(
      `SELECT u.id,
              oa.display_name AS "displayName",
              oa.username,
              oa.email,
              oa.avatar_url AS "avatarUrl"
       FROM users u
       JOIN oauth_accounts oa ON oa.user_id = u.id
       WHERE u.id = $1 AND oa.provider = $2`,
      [userId, githubProvider],
    )

    const user = result.rows[0]
    if (!user) {
      throw new Error('Unable to load the persisted GitHub account.')
    }

    await client.query('COMMIT')
    transactionStarted = false
    return user
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'GitHub account transaction and rollback failed.')
      }
    }
    throw error
  } finally {
    client.release()
  }
}

export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  const result = await pool.query<AuthUserRow>(
    `SELECT u.id,
            oa.display_name AS "displayName",
            oa.username,
            oa.email,
            oa.avatar_url AS "avatarUrl"
     FROM users u
     JOIN oauth_accounts oa ON oa.user_id = u.id
     WHERE u.id = $1
     ORDER BY oa.created_at
     LIMIT 1`,
    [id],
  )

  return result.rows[0] ?? null
}

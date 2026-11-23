import passport from 'passport'
import { Strategy as GitHubStrategy, type Profile } from 'passport-github2'
import { z } from 'zod'
import { githubStateStore } from './github-state-store.js'
import { config } from '../config.js'
import { findAuthUserById, upsertGitHubUser } from '../db/auth-repository.js'

const githubProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  username: z.string().nullable().optional(),
  emails: z.array(z.object({ value: z.string().email() })).optional(),
  photos: z
    .array(
      z.object({
        value: z
          .string()
          .url()
          .refine((value) => value.startsWith('https://')),
      }),
    )
    .optional(),
})

type GitHubVerifyCallback = (error?: Error | null, user?: Express.User | false, info?: object) => void

passport.use(
  new GitHubStrategy(
    {
      clientID: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
      callbackURL: new URL('/auth/github/callback', config.API_ORIGIN).toString(),
      scope: ['read:user'],
      store: githubStateStore,
    },
    (_accessToken: string, _refreshToken: string, profile: Profile, done: GitHubVerifyCallback) => {
      const parsedProfile = githubProfileSchema.safeParse(profile)
      if (!parsedProfile.success) {
        done(new Error('GitHub returned an invalid user profile.'))
        return
      }

      const githubProfile = {
        providerUserId: parsedProfile.data.id,
        displayName: parsedProfile.data.displayName || parsedProfile.data.username || 'GitHub user',
        username: parsedProfile.data.username ?? null,
        email: parsedProfile.data.emails?.[0]?.value ?? null,
        avatarUrl: parsedProfile.data.photos?.[0]?.value ?? null,
      }

      void upsertGitHubUser(githubProfile)
        .then((user) => done(null, user))
        .catch((error: unknown) => {
          done(error instanceof Error ? error : new Error('GitHub account persistence failed.'))
        })
    },
  ),
)

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser((id: string, done) => {
  void findAuthUserById(id)
    .then((user) => done(null, user ?? false))
    .catch((error: unknown) => {
      done(error instanceof Error ? error : new Error('Account lookup failed.'))
    })
})

export { passport }

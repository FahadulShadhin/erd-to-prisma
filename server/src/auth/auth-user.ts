export interface AuthUser {
  id: string
  displayName: string
  username: string | null
  email: string | null
  avatarUrl: string | null
}

export interface GitHubProfileData {
  providerUserId: string
  displayName: string
  username: string | null
  email: string | null
  avatarUrl: string | null
}

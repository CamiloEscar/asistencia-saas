import { useAuthStore, type AuthUser, type AuthInstitution } from './stores/auth.store'

/** Hook used by components to read auth state. */
export interface UseAuthResult {
  user: AuthUser | null
  institution: AuthInstitution | null
  isAuthenticated: boolean
}

export function useAuth(): UseAuthResult {
  const user = useAuthStore((s) => s.user)
  const institution = useAuthStore((s) => s.institution)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return { user, institution, isAuthenticated }
}

import { useAuthStore, type AuthUser } from './stores/auth.store'

/** Hook used by components to read auth state. */
export interface UseAuthResult {
  user: AuthUser | null
  isAuthenticated: boolean
}

export function useAuth(): UseAuthResult {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return { user, isAuthenticated }
}

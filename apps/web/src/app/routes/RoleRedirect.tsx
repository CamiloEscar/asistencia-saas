import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/use-auth'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { landingPathForRole, Paths } from './paths'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'

/**
 * Index route (`/`). Redirects to the role's canonical landing page
 * (super-admin → /admin, admin → /dashboard, teacher → /today, student
 * → /me). When not authenticated, sends to /login.
 *
 * We can't tell from `useAuth()` alone whether the AuthProvider has
 * finished its initial /auth/me call. We approximate it by checking
 * whether the store has been touched at all on first mount: if the
 * store has a hydrated user, the call returned; if `user` is null
 * AFTER a microtask, the call has returned with no user (logged out).
 */
export function RoleRedirect() {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  const storeUser = useAuthStore((s) => s.user)

  // Heuristic: if the store already had a value from localStorage, we
  // trust it. Otherwise we show a loading screen for one frame while
  // the AuthProvider resolves /auth/me in the background.
  if (!storeUser && !isAuthenticated) {
    return <LoadingScreen />
  }

  if (!isAuthenticated || !user) {
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${Paths.login}?returnTo=${returnTo}`} replace />
  }

  return <Navigate to={landingPathForRole(user.role)} replace />
}

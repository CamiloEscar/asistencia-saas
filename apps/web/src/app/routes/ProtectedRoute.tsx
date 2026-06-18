import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '@asistencia/shared'
import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/use-auth'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { Paths } from './paths'

interface ProtectedRouteProps {
  /** Allowed roles. If omitted, any authenticated user passes. */
  allowedRoles?: ReadonlyArray<(typeof UserRole)[keyof typeof UserRole]>
  /**
   * Optional children. When set, the children are rendered instead of
   * the Outlet — useful when a route wants to gate a single element
   * (e.g. `<ProtectedRoute allowedRoles={...}><Foo /></ProtectedRoute>`)
   * without wrapping it in an extra `<Route element>` block.
   */
  children?: ReactNode
}

/**
 * Gate for authenticated routes. Behavior:
 *  - User not signed in → redirect to /login?returnTo=<currentPath>.
 *  - User signed in but role not in `allowedRoles` → redirect to /403.
 *  - User signed in (and role allowed) → render children (if any) or
 *    `<Outlet />` (for nested route definitions).
 *
 * The store has the user from localStorage on the very first render
 * (the AuthProvider hydrates it from /auth/me in the background). While
 * the in-memory state is `null` we don't yet know if the user is signed
 * in or not — we render a loading screen to avoid a flash of /login.
 */
export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()

  // No user in store. Wait for the AuthProvider to finish bootstrapping
  // (it clears the store on a 401 from /auth/me, but on first paint we
  // can't yet tell the difference). Show a spinner for ~1 frame.
  if (!user) {
    if (isAuthenticated) {
      return <LoadingScreen />
    }
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${Paths.login}?returnTo=${returnTo}`} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={Paths.forbidden} replace />
  }

  return children ? <>{children}</> : <Outlet />
}

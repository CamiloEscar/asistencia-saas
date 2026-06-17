import { Outlet } from 'react-router-dom'

/**
 * Wrapper that gates routes behind authentication. If the user has no session,
 * redirect to /login with the original path as `returnTo` (per FE-REQ-AUTH-006).
 *
 * The actual session check (call to /auth/me or store read) is wired in a
 * later task (12.4 / 12.7). For now this is a stub that always renders
 * children, so the FE compiles and the router is testable.
 */
export function ProtectedRoute() {
  // TODO(task 12.4): const { user, isLoading } = useAuth();
  // if (isLoading) return <LoadingScreen />;
  // if (!user) return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  return <Outlet />
}

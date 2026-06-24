import { Navigate } from 'react-router-dom'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { useAuth } from '@/features/auth/use-auth'
import { Paths } from '@/app/routes/paths'
import { AdminDashboard } from './AdminDashboard'
import { TeacherDashboard } from './TeacherDashboard'
import { StudentDashboard } from './StudentDashboard'

/**
 * Role-based dashboard router. Picks the correct variant for the
 * current user's role. Unknown roles bounce to /403.
 */
export function DashboardPage() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    // ProtectedRoute normally prevents this state, but guard anyway
    // so a hot-reload race can't render the wrong dashboard.
    return <LoadingScreen />
  }

  switch (user.role) {
    case 'ADMIN':
      return <AdminDashboard />
    case 'TEACHER':
      return <TeacherDashboard />
    case 'STUDENT':
      return <StudentDashboard />
    default:
      return <Navigate to={Paths.forbidden} replace />
  }
}

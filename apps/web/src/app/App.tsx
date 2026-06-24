import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './providers/I18nProvider'
import { QueryProvider } from './providers/QueryProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { ToasterProvider } from './providers/ToasterProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { NotFoundPage } from './routes/NotFoundPage'
import { ForbiddenPage } from './routes/ForbiddenPage'
import { ServerErrorPage } from './routes/ServerErrorPage'
import { MaintenancePage } from './routes/MaintenancePage'
import { NotConnectedPage } from './routes/NotConnectedPage'
import { RoleRedirect } from './routes/RoleRedirect'
import { UserRole } from '@asistencia/shared'
import { Paths } from './routes/paths'

// Lazy-loaded feature pages (code splitting per route).
const LoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const SetPasswordPage = lazy(() =>
  import('@/features/activation/pages/SetPasswordPage').then((m) => ({
    default: m.SetPasswordPage,
  })),
)
const ForgotPasswordPage = lazy(() =>
  import('@/features/activation/pages/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
)

// Dashboards
const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
// Users (admin)
const UsersListPage = lazy(() =>
  import('@/features/users/pages/UsersListPage').then((m) => ({ default: m.UsersListPage })),
)

// Students
const StudentsListPage = lazy(() =>
  import('@/features/students/pages/StudentsListPage').then((m) => ({
    default: m.StudentsListPage,
  })),
)
const BulkImportPage = lazy(() =>
  import('@/features/students/pages/BulkImportPage').then((m) => ({ default: m.BulkImportPage })),
)

// Teachers
const TeachersListPage = lazy(() =>
  import('@/features/teachers/pages/TeachersListPage').then((m) => ({
    default: m.TeachersListPage,
  })),
)

// Subjects
const SubjectsListPage = lazy(() =>
  import('@/features/subjects/pages/SubjectsListPage').then((m) => ({
    default: m.SubjectsListPage,
  })),
)

// Courses
const CoursesListPage = lazy(() =>
  import('@/features/courses/pages/CoursesListPage').then((m) => ({ default: m.CoursesListPage })),
)
const CourseDetailPage = lazy(() =>
  import('@/features/courses/pages/CourseDetailPage').then((m) => ({
    default: m.CourseDetailPage,
  })),
)

// Attendance (teacher)
const TakeAttendancePage = lazy(() =>
  import('@/features/attendance/pages/TakeAttendancePage').then((m) => ({
    default: m.TakeAttendancePage,
  })),
)
const AttendanceHistoryPage = lazy(() =>
  import('@/features/attendance/pages/AttendanceHistoryPage').then((m) => ({
    default: m.AttendanceHistoryPage,
  })),
)

// Attendance (student)
const MyAttendancePage = lazy(() =>
  import('@/features/attendance/pages/MyAttendancePage').then((m) => ({
    default: m.MyAttendancePage,
  })),
)
const MyAttendanceDetailPage = lazy(() =>
  import('@/features/attendance/pages/MyAttendanceDetailPage').then((m) => ({
    default: m.MyAttendanceDetailPage,
  })),
)

// Profile / settings
const ProfilePage = lazy(() =>
  import('@/features/profile/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

export function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <BrowserRouter>
              <Suspense fallback={<LoadingScreen />}>
                <SkipToContent />
                <Routes>
                  {/* Public routes */}
                  <Route path={Paths.login} element={<LoginPage />} />
                  <Route path={Paths.setPassword} element={<SetPasswordPage />} />
                  <Route path={Paths.forgotPassword} element={<ForgotPasswordPage />} />
                  <Route path={Paths.forbidden} element={<ForbiddenPage />} />
                  <Route path="/500" element={<ServerErrorPage />} />
                  <Route path="/503" element={<MaintenancePage />} />
                  <Route path="/offline" element={<NotConnectedPage />} />

                  {/* Protected routes (all under the AppShell) */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<RoleRedirect />} />
                      <Route path={Paths.dashboard} element={<DashboardPage />} />
                      {/* Users - ADMIN only */}
                      <Route
                        path={Paths.users}
                        element={
                          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                            <UsersListPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Students - INSTITUTION_ADMIN+ */}
                      <Route
                        path={Paths.students}
                        element={
                          <ProtectedRoute
                            allowedRoles={[UserRole.ADMIN, UserRole.TEACHER]}
                          >
                            <StudentsListPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={Paths.studentsBulkImport}
                        element={
                          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                            <BulkImportPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Teachers - INSTITUTION_ADMIN+ */}
                      <Route
                        path={Paths.teachers}
                        element={
                          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                            <TeachersListPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Subjects - INSTITUTION_ADMIN+ */}
                      <Route
                        path={Paths.subjects}
                        element={
                          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                            <SubjectsListPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Courses - INSTITUTION_ADMIN+ and TEACHER (read) */}
                      <Route path={Paths.courses} element={<CoursesListPage />} />
                      <Route path={Paths.courseDetail(':id')} element={<CourseDetailPage />} />

                      {/* Attendance (teacher) */}
                      <Route
                        path={Paths.takeAttendance(':id')}
                        element={
                          <ProtectedRoute
                            allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}
                          >
                            <TakeAttendancePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={Paths.attendanceHistory}
                        element={
                          <ProtectedRoute
                            allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}
                          >
                            <AttendanceHistoryPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Attendance (student) */}
                      <Route
                        path={Paths.me}
                        element={
                          <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                            <MyAttendancePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={Paths.myAttendance}
                        element={
                          <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                            <MyAttendancePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={Paths.myCourse(':id')}
                        element={
                          <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                            <MyAttendanceDetailPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Teacher today dashboard */}
                      <Route
                        path={Paths.today}
                        element={
                          <ProtectedRoute allowedRoles={[UserRole.TEACHER]}>
                            <DashboardPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Profile & Settings */}
                      <Route path={Paths.profile} element={<ProfilePage />} />
                      <Route path={Paths.settings} element={<SettingsPage />} />
                    </Route>
                  </Route>

                  {/* 404 catch-all (must stay last) */}
                  <Route path="*" element={<NotFoundPage />} />

                  {/* Sentinel route so a stale Navigate doesn't break the JSX tree. */}
                  <Route path="__noop" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
              <ToasterProvider />
            </BrowserRouter>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryProvider>
  )
}

/**
 * Skip-to-content link for keyboard users. Visually hidden until focused.
 * Per WAI-ARIA practices, lets screen-reader and keyboard users bypass
 * the navigation and jump straight to the main content.
 */
function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
    >
      Saltar al contenido principal
    </a>
  )
}

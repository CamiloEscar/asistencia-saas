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
import { RoleRedirect } from './routes/RoleRedirect'
import { UserRole } from '@asistencia/shared'
import { Paths } from './routes/paths'

// Lazy-loaded feature pages.
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
const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

export function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <BrowserRouter>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  {/* Public routes */}
                  <Route path={Paths.login} element={<LoginPage />} />
                  <Route path={Paths.setPassword} element={<SetPasswordPage />} />
                  <Route path={Paths.forgotPassword} element={<ForgotPasswordPage />} />
                  <Route path={Paths.forbidden} element={<ForbiddenPage />} />

                  {/* Protected routes (all under the AppShell) */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<RoleRedirect />} />
                      <Route path={Paths.dashboard} element={<DashboardPage />} />
                      <Route path={Paths.admin} element={<DashboardPage />} />
                      <Route path={Paths.today} element={<DashboardPage />} />
                      <Route path={Paths.me} element={<DashboardPage />} />
                    </Route>
                  </Route>

                  {/* SUPER_ADMIN-only institution routes */}
                  <Route element={<ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]} />}>
                    <Route element={<AppShell />}>
                      <Route path={Paths.institutions} element={<DashboardPage />} />
                      <Route path={Paths.institutionNew} element={<DashboardPage />} />
                      <Route path={Paths.institutionDetail(':id')} element={<DashboardPage />} />
                      <Route path={Paths.institutionEdit(':id')} element={<DashboardPage />} />
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

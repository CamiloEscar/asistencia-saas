import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { I18nProvider } from './providers/I18nProvider';
import { LoadingScreen } from '../components/feedback/LoadingScreen';
import { ProtectedRoute } from './routes/ProtectedRoute';

// Lazy-load feature pages. The actual pages are added in subsequent tasks
// (12.x for the FE foundation, 13.x for dashboards, 14.x for CRUD, 15.x/16.x
// for the critical attendance flows). For now we only ship a stub login page
// and the role-based redirect.
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const NotFoundPage = lazy(() => import('./routes/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s default; per-resource overrides in features/*.
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

export function App() {
  const isDev = import.meta.env.DEV;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <I18nProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<div className="p-6">Dashboard (stub)</div>} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <Toaster richColors position="top-right" />
          </BrowserRouter>
        </I18nProvider>
      </ThemeProvider>
      {isDev && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

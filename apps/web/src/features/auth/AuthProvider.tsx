import { useEffect } from 'react'
import type { MeResponse } from '@asistencia/shared'
import apiClient from '@/lib/api-client'
import { useAuthStore } from './stores/auth.store'

/**
 * AuthProvider — on mount, calls GET /auth/me to validate the session
 * and populate the auth store. Exposes `useAuth()` for components.
 *
 * The provider is intentionally minimal: it only hydrates the store.
 * Login / logout / refresh are owned by hooks (useLogin, useLogout) so
 * they can be triggered from anywhere in the tree.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate)
  const clearUser = useAuthStore((s) => s.clearUser)
  const setBootstrapping = useAuthStore((s) => s.setBootstrapping)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const { data } = await apiClient.get<MeResponse>('/auth/me')
        if (!cancelled) hydrate(data)
      } catch (err) {
        // 401 is expected when not signed in — silent.
        // Any other error is logged but does not break the app.
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status
          if (status !== 401) {
            console.warn('[auth] /auth/me failed:', (err as Error).message)
          }
          clearUser()
        }
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [hydrate, clearUser, setBootstrapping])

  // Listen for the api-client's auth-lost event (refresh failed). We
  // re-export it through the store so subscribers (router) can react.
  useEffect(() => {
    const onAuthLost = (event: Event) => {
      const detail = (event as CustomEvent<{ reason: 'session_expired' | 'session_revoked' }>)
        .detail
      // The store is already cleared by the api-client. We just expose
      // the reason via a DOM event for any subscriber that wants to
      // show a toast.
      if (typeof window !== 'undefined' && detail?.reason === 'session_revoked') {
        // Lazy import to avoid circular dep on sonner at module top.
        void import('sonner').then(({ toast }) => {
          toast.error('Tu sesión fue revocada por seguridad. Iniciá sesión nuevamente.')
        })
      }
    }
    window.addEventListener('asistencia:auth-lost', onAuthLost)
    return () => window.removeEventListener('asistencia:auth-lost', onAuthLost)
  }, [])

  return <>{children}</>
}

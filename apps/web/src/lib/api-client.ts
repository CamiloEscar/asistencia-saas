import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { ProblemJson } from '@asistencia/shared'
import { useAuthStore } from '@/features/auth/stores/auth.store'


/**
 * Axios instance configured for the asistencia-saas API.
 *
 * Key behaviors (per spec FE-REQ-AUTH-005):
 *  - `withCredentials: true` so the browser sends the HttpOnly auth cookies.
 *  - Request interceptor adds `Accept-Language: es` (default UI locale).
 *  - Response interceptor handles 401: queues the failed request, calls
 *    POST /auth/refresh ONCE (concurrent 401s share the same promise), and
 *    retries the queue. On refresh-fail it clears the auth store and lets
 *    the caller handle the redirect (kept here to avoid a router dep).
 *
 * CSRF: a future iteration will read a non-HttpOnly `asistencia_csrf` cookie
 * and attach it as `X-CSRF-Token` on POST/PATCH/DELETE (per design §13.3).
 */

/** Storage key for the previously-requested path so the LoginPage can
 *  redirect back after a forced re-login. */
const RETURN_TO_KEY = 'asistencia_return_to'
export function getReturnTo(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(RETURN_TO_KEY)
}
export function setReturnTo(path: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(RETURN_TO_KEY, path)
}
export function clearReturnTo(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(RETURN_TO_KEY)
}

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ── Request interceptor ────────────────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers.set('Accept-Language', 'es')
  return config
})

// ── Response interceptor: refresh-on-401 ────────────────────────────────────
let refreshPromise: Promise<unknown> | null = null
let isRefreshing = false
const queue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  config: AxiosRequestConfig
}> = []

function isRefreshEndpoint(url?: string): boolean {
  if (!url) return false
  return url.includes('/auth/refresh') || url.includes('/auth/login')
}

function flushQueue(error: unknown, success = false): void {
  while (queue.length) {
    const item = queue.shift()
    if (!item) continue
    if (success) {
      apiClient.request(item.config).then(item.resolve, item.reject)
    } else {
      item.reject(error)
    }
  }
}

function performRefresh(): Promise<unknown> {
  if (refreshPromise) return refreshPromise
  isRefreshing = true
  refreshPromise = apiClient.post('/auth/refresh', {}, { withCredentials: true }).finally(() => {
    isRefreshing = false
    // Allow a future refresh cycle.
    refreshPromise = null
  })
  return refreshPromise
}

function forceLogout(reason: 'session_expired' | 'session_revoked'): void {
  // Remember the current path so the LoginPage can return the user there
  // after a fresh login.
  if (typeof window !== 'undefined') {
    setReturnTo(window.location.pathname + window.location.search)
  }
  useAuthStore.getState().clearUser()
  // Notify any subscriber (router) to redirect. We use a custom event to
  // keep api-client free of router imports.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('asistencia:auth-lost', { detail: { reason } }))
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ProblemJson>) => {
    const status = error.response?.status
    const original = error.config as AxiosRequestConfig | undefined

    // Network / timeout — let the caller handle.
    if (!status || !original) {
      return Promise.reject(error)
    }

    // Only 401 triggers the refresh dance.
    if (status !== 401) {
      return Promise.reject(error)
    }

    // Never try to refresh a refresh or login request — would loop forever.
    if (isRefreshEndpoint(original.url)) {
      const reason = (error.response?.data as ProblemJson | undefined)?.detail?.includes('revoked')
        ? 'session_revoked'
        : 'session_expired'
      forceLogout(reason)
      return Promise.reject(error)
    }

    // If a refresh is already in flight, queue this request and wait.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject, config: original })
      })
    }

    // Kick off the single refresh.
    try {
      await performRefresh()
      flushQueue(null, true)
      return apiClient.request(original)
    } catch (refreshError) {
      flushQueue(refreshError, false)
      const reason =
        refreshError instanceof AxiosError &&
        (refreshError.response?.data as ProblemJson | undefined)?.detail?.includes('revoked')
          ? 'session_revoked'
          : 'session_expired'
      forceLogout(reason)
      return Promise.reject(refreshError)
    }
  },
)

export default apiClient

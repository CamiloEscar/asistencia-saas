import type { ProblemJson } from '@asistencia/shared'
import { getReturnTo, clearReturnTo } from '@/lib/api-client'

/**
 * Type-safe error extractor for API calls. Strips the RFC 7807 fields
 * (`title`, `detail`, `errors`) into a small object the UI can render
 * without re-typing Axios shapes everywhere.
 */
export interface ApiErrorShape {
  status: number
  title: string
  detail?: string
  fields?: Array<{ field: string; message: string }>
}

export function toApiError(err: unknown): ApiErrorShape {
  const e = err as { response?: { status?: number; data?: ProblemJson }; message?: string }
  const data = e?.response?.data
  return {
    status: e?.response?.status ?? 0,
    title: data?.title ?? 'Error',
    detail: data?.detail ?? e?.message,
    fields: data?.errors,
  }
}

/**
 * Helper used by the login flow. Returns the path the user was trying
 * to reach before being kicked to /login, or `defaultPath` if none was
 * recorded.
 */
export function applyReturnTo(defaultPath: string): string {
  const r = getReturnTo()
  clearReturnTo()
  return r && r !== '/login' ? r : defaultPath
}

/** Map a 4xx ProblemJson to a localised, UI-friendly message key. */
export function problemMessageKey(err: unknown): string {
  const { status, title } = toApiError(err)
  if (status === 401) return 'errors:unauthorized'
  if (status === 403) {
    if (title?.toLowerCase().includes('inactive')) return 'errors:inactiveInstitution'
    return 'errors:forbidden'
  }
  if (status === 404) return 'errors:notFound'
  if (status === 422 || status === 400) return 'errors:validation'
  if (status === 429) return 'errors:rateLimited'
  if (status >= 500) return 'errors:serverError'
  return 'errors:generic'
}

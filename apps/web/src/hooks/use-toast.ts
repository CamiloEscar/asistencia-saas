import { toast } from 'sonner'
import i18n from '@/app/providers/i18n-setup'
import { problemMessageKey } from '@/features/auth/auth.helpers'

/**
 * Toast helpers that wrap Sonner with i18n-aware messages. Features
 * call `useToast().success(...)` etc. — this hook returns a stable
 * object that does not re-render.
 */
export interface ToastApi {
  success: (message: string, description?: string) => void
  error: (message: string | unknown, description?: string) => void
  info: (message: string, description?: string) => void
  warning: (message: string, description?: string) => void
  /** Convert an API error to a localised toast in one call. */
  errorFromApi: (err: unknown, fallbackKey?: string) => void
  /** Dismiss all open toasts. */
  dismiss: () => void
}

export function useToast(): ToastApi {
  function t(key: string, fallback = key): string {
    return i18n.t(key, fallback) as string
  }

  return {
    success: (message, description) => toast.success(message, { description }),
    error: (message, description) => {
      const text = typeof message === 'string' ? message : String(message)
      toast.error(text, { description })
    },
    info: (message, description) => toast.info(message, { description }),
    warning: (message, description) => toast.warning(message, { description }),
    errorFromApi: (err, fallbackKey = 'errors:generic') => {
      const key = problemMessageKey(err)
      toast.error(t(key, t(fallbackKey)))
    },
    dismiss: () => toast.dismiss(),
  }
}

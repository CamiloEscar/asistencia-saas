import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { ReactNode } from 'react'
import { createQueryClient } from '@/lib/query-client'

/**
 * TanStack Query provider. The QueryClient is created lazily on first
 * render so we can guarantee a single instance per app (avoids
 * double-fetching in dev StrictMode).
 */
const queryClient = createQueryClient()

export function QueryProvider({ children }: { children: ReactNode }) {
  const isDev = import.meta.env.DEV
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {isDev && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

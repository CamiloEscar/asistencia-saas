import { QueryClient } from '@tanstack/react-query'

/**
 * Shared QueryClient factory. The instance is created once and reused.
 * Per-resource `staleTime` is overridden in feature hooks when needed
 * (e.g. subjects catalog = 5 min, today-sessions = 0).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s default; per-resource overrides live in feature hooks.
        gcTime: 5 * 60_000, // 5 min — queries are kept in memory for fast re-mounts.
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

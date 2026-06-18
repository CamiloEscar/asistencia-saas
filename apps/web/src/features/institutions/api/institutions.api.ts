import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type { PaginatedResponse, Institution } from '@asistencia/shared'

const institutionsKey = ['institutions', 'list'] as const

/**
 * Fetch the most recent N institutions for the super-admin dashboard.
 * The list endpoint already paginates; we just request the smallest
 * page size that fits the "last 5" widget.
 */
export function useRecentInstitutions(limit = 5) {
  return useQuery({
    queryKey: [...institutionsKey, { limit }],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Institution>>('/institutions', {
        params: { limit },
      })
      return data
    },
    staleTime: 60_000,
  })
}

const statsKey = ['super-admin', 'stats'] as const
export interface SuperAdminStats {
  total: number
  active: number
  inactive: number
}

/**
 * Aggregate counts for the super-admin KPIs. The backend exposes a
 * `/super/stats` endpoint; until it ships, we approximate from the
 * list endpoint (single full fetch, then count locally).
 */
export function useSuperAdminStats() {
  return useQuery({
    queryKey: statsKey,
    queryFn: async (): Promise<SuperAdminStats> => {
      const { data } = await apiClient.get<PaginatedResponse<Institution>>('/institutions', {
        params: { limit: 100 },
      })
      const total = data.data.length + (data.hasMore ? 1 : 0) // lower bound when hasMore
      const active = data.data.filter((i) => i.status === 'ACTIVE').length
      const inactive = data.data.filter((i) => i.status === 'INACTIVE').length
      return { total, active, inactive }
    },
    staleTime: 60_000,
  })
}

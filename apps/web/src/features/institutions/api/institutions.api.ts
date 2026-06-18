import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import apiClient from '@/lib/api-client'
import type {
  CreateInstitutionRequest,
  Institution,
  ListInstitutionsQuery,
  PaginatedResponse,
  UpdateInstitutionRequest,
} from '@asistencia/shared'

/**
 * Institution API (super-admin only). Endpoints are documented in
 * `packages/shared/src/dtos/institution.ts`.
 */

const keys = {
  all: ['institutions'] as const,
  list: (q: ListInstitutionsQuery) => [...keys.all, 'list', q] as const,
  stats: () => [...keys.all, 'stats'] as const,
  recent: (limit: number) => [...keys.all, 'recent', limit] as const,
}

export function useListInstitutions(query: ListInstitutionsQuery) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Institution>>('/institutions', {
        params: query,
      })
      return data
    },
    staleTime: 30_000,
  })
}

export function useRecentInstitutions(limit = 5) {
  return useQuery({
    queryKey: keys.recent(limit),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Institution>>('/institutions', {
        params: { limit },
      })
      return data
    },
    staleTime: 60_000,
  })
}

export interface SuperAdminStats {
  total: number
  active: number
  inactive: number
}

export function useSuperAdminStats() {
  return useQuery({
    queryKey: keys.stats(),
    queryFn: async (): Promise<SuperAdminStats> => {
      const { data } = await apiClient.get<PaginatedResponse<Institution>>('/institutions', {
        params: { limit: 100 },
      })
      const total = data.data.length + (data.hasMore ? 1 : 0)
      const active = data.data.filter((i) => i.status === 'ACTIVE').length
      const inactive = data.data.filter((i) => i.status === 'INACTIVE').length
      return { total, active, inactive }
    },
    staleTime: 60_000,
  })
}

export interface CreateInstitutionResponse {
  institution: Institution
  setPasswordLink?: string
  temporaryPassword?: string
}

export function useCreateInstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      payload: CreateInstitutionRequest & { logo?: File },
    ): Promise<CreateInstitutionResponse> => {
      // If a logo file is provided, send as multipart. Otherwise JSON.
      if (payload.logo) {
        const fd = new FormData()
        Object.entries(payload).forEach(([k, v]) => {
          if (k === 'logo' && v instanceof File) fd.append('logo', v)
          else if (v !== undefined && v !== null) fd.append(k, String(v))
        })
        const { data } = await apiClient.post<CreateInstitutionResponse>('/institutions', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return data
      }
      const { logo: _logo, ...rest } = payload
      const { data } = await apiClient.post<CreateInstitutionResponse>('/institutions', rest)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useUpdateInstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; data: UpdateInstitutionRequest }) => {
      const { data } = await apiClient.patch<Institution>(`/institutions/${vars.id}`, vars.data)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useDeactivateInstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Institution>(`/institutions/${id}/deactivate`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useReactivateInstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Institution>(`/institutions/${id}/reactivate`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useUploadLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; file: File }) => {
      const fd = new FormData()
      fd.append('logo', vars.file)
      const { data } = await apiClient.post<{ logoUrl: string }>(
        `/institutions/${vars.id}/logo`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

// Re-export for use in components that need a `useState`-driven query.
export function useInstitutionsQuery() {
  const [query, setQuery] = useState<ListInstitutionsQuery>({ limit: 20 })
  const list = useListInstitutions(query)
  return { query, setQuery, list }
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type {
  CreateSubjectRequest,
  ListSubjectsQuery,
  PaginatedResponse,
  Subject,
  UpdateSubjectRequest,
} from '@asistencia/shared'

const keys = {
  all: ['subjects'] as const,
  list: (q: ListSubjectsQuery) => [...keys.all, 'list', q] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
}

export function useListSubjects(query: ListSubjectsQuery) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Subject>>('/subjects', {
        params: query,
      })
      return data
    },
    staleTime: 5 * 60_000, // catalog, refresh every 5 min
  })
}

export function useSubject(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<Subject>(`/subjects/${id}`)
      return data
    },
    enabled: Boolean(id),
  })
}

export function useCreateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSubjectRequest) => {
      const { data } = await apiClient.post<Subject>('/subjects', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; data: UpdateSubjectRequest }) => {
      const { data } = await apiClient.patch<Subject>(`/subjects/${vars.id}`, vars.data)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeactivateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Subject>(`/subjects/${id}/deactivate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

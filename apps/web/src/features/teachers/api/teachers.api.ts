import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type {
  ListTeachersQuery,
  PaginatedResponse,
  Teacher,
  UpdateUserRequest,
  User,
} from '@asistencia/shared'

const keys = {
  all: ['teachers'] as const,
  list: (q: ListTeachersQuery) => [...keys.all, 'list', q] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
}

export function useListTeachers(query: ListTeachersQuery) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Teacher>>('/teachers', {
        params: query,
      })
      return data
    },
    staleTime: 30_000,
  })
}

export function useTeacher(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<Teacher>(`/teachers/${id}`)
      return data
    },
    enabled: Boolean(id),
  })
}

export function useCreateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      email: string
      fullName: string
      phone?: string
      userId?: string
    }) => {
      const { data } = await apiClient.post<User>('/teachers', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; data: UpdateUserRequest }) => {
      const { data } = await apiClient.patch<Teacher>(`/teachers/${vars.id}`, vars.data)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeactivateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Teacher>(`/teachers/${id}/deactivate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

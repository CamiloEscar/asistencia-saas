import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type {
  CreateUserRequest,
  ListUsersQuery,
  PaginatedResponse,
  UpdateUserRequest,
  User,
} from '@asistencia/shared'

const keys = {
  all: ['users'] as const,
  list: (q: ListUsersQuery) => [...keys.all, 'list', q] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
}

export function useListUsers(query: ListUsersQuery) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<User>>('/users', { params: query })
      return data
    },
    staleTime: 30_000,
  })
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<User>(`/users/${id}`)
      return data
    },
    enabled: Boolean(id),
  })
}

export interface CreateUserResponse {
  user: User
  setPasswordLink?: string
  temporaryPassword?: string
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateUserRequest): Promise<CreateUserResponse> => {
      const { data } = await apiClient.post<CreateUserResponse>('/users', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; data: UpdateUserRequest }) => {
      const { data } = await apiClient.patch<User>(`/users/${vars.id}`, vars.data)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<User>(`/users/${id}/deactivate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useReactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<User>(`/users/${id}/reactivate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export interface ResetPasswordResponse {
  temporaryPassword: string
  setPasswordLink?: string
}

export function useResetPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<ResetPasswordResponse> => {
      const { data } = await apiClient.post<ResetPasswordResponse>(`/users/${id}/reset-password`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

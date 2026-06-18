import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type {
  BulkImportResponse,
  CreateStudentRequest,
  ListStudentsQuery,
  PaginatedResponse,
  UpdateStudentRequest,
  User,
} from '@asistencia/shared'

const keys = {
  all: ['students'] as const,
  list: (q: ListStudentsQuery) => [...keys.all, 'list', q] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
  bulkJob: (jobId: string) => [...keys.all, 'bulk', jobId] as const,
}

export function useListStudents(query: ListStudentsQuery) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<User>>('/students', {
        params: query,
      })
      return data
    },
    staleTime: 30_000,
  })
}

export function useStudent(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<User>(`/students/${id}`)
      return data
    },
    enabled: Boolean(id),
  })
}

export function useCreateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateStudentRequest) => {
      const { data } = await apiClient.post<User>('/students', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; data: UpdateStudentRequest }) => {
      const { data } = await apiClient.patch<User>(`/students/${vars.id}`, vars.data)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeactivateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<User>(`/students/${id}/deactivate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export interface BulkImportInput {
  file: File
  dryRun: boolean
  courseId?: string
}

export function useBulkImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: BulkImportInput): Promise<BulkImportResponse> => {
      const fd = new FormData()
      fd.append('file', input.file)
      if (input.courseId) fd.append('courseId', input.courseId)
      const { data } = await apiClient.post<BulkImportResponse>('/students/bulk', fd, {
        params: { dryRun: input.dryRun ? 'true' : 'false' },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useBulkJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: keys.bulkJob(jobId ?? ''),
    queryFn: async (): Promise<BulkImportResponse> => {
      const { data } = await apiClient.get<BulkImportResponse>(`/students/bulk/${jobId}/status`)
      return data
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') return false
      return 2_000
    },
  })
}

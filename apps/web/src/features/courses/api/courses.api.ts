import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type {
  AssignTeachersRequest,
  Course,
  CreateCourseRequest,
  EnrollStudentsRequest,
  ListCoursesQuery,
  PaginatedResponse,
  UpdateCourseRequest,
  User,
} from '@asistencia/shared'

const keys = {
  all: ['courses'] as const,
  list: (q: ListCoursesQuery) => [...keys.all, 'list', q] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
  students: (id: string) => [...keys.all, id, 'students'] as const,
}

export function useListCourses(query: ListCoursesQuery) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Course>>('/courses', {
        params: query,
      })
      return data
    },
    staleTime: 30_000,
  })
}

export function useCourse(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<
        Course & { schedule: Array<{ day: number; startTime: string; endTime: string }> }
      >(`/courses/${id}`)
      return data
    },
    enabled: Boolean(id),
  })
}

export function useCourseStudents(courseId: string | undefined) {
  return useQuery({
    queryKey: keys.students(courseId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<User>>(`/courses/${courseId}/students`)
      return data
    },
    enabled: Boolean(courseId),
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCourseRequest) => {
      const { data } = await apiClient.post<Course>('/courses', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; data: UpdateCourseRequest }) => {
      const { data } = await apiClient.patch<Course>(`/courses/${vars.id}`, vars.data)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeactivateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Course>(`/courses/${id}/deactivate`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useEnrollStudents(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: EnrollStudentsRequest) => {
      const { data } = await apiClient.post<{ added: number }>(
        `/courses/${courseId}/enrollments`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: keys.students(courseId) })
    },
  })
}

export function useUnenrollStudent(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (studentId: string) => {
      const { data } = await apiClient.delete<{ removed: number }>(
        `/courses/${courseId}/enrollments/${studentId}`,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.students(courseId) })
    },
  })
}

export function useAssignTeachers(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AssignTeachersRequest) => {
      const { data } = await apiClient.post<{ added: number }>(
        `/courses/${courseId}/teachers`,
        payload,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

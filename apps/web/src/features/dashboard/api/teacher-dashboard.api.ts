import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type { ClassSession, TeacherTodaySummary, PaginatedResponse } from '@asistencia/shared'

const todayKey = ['teacher', 'today-sessions'] as const

export function useTeacherToday() {
  return useQuery({
    queryKey: todayKey,
    queryFn: async (): Promise<TeacherTodaySummary> => {
      const { data } = await apiClient.get<TeacherTodaySummary>('/me/sessions/today')
      return data
    },
    staleTime: 0, // always refetch — teacher views are time-sensitive
  })
}

const myCoursesKey = ['teacher', 'my-courses'] as const
export function useMyCourses() {
  return useQuery({
    queryKey: myCoursesKey,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<{ id: string; name: string }>>(
        '/me/courses',
        { params: { limit: 50 } },
      )
      return data.data
    },
    staleTime: 5 * 60_000,
  })
}

export function useRecentSessions() {
  return useQuery({
    queryKey: ['teacher', 'recent-sessions'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<ClassSession>>('/attendance', {
        params: { limit: 5 },
      })
      return data.data
    },
    staleTime: 30_000,
  })
}

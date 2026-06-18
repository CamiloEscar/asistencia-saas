import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type { StudentAttendanceSummary } from '@asistencia/shared'

/**
 * Student attendance summary (overall + by-course). Used by the
 * /me/attendance page.
 */
export function useMyAttendanceSummary() {
  return useQuery({
    queryKey: ['attendance', 'me', 'summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<StudentAttendanceSummary>('/me/attendance/summary')
      return data
    },
    staleTime: 30_000,
  })
}

/**
 * Course-level history with sessions + a date range filter. The
 * backend paginates sessions; for the MVP we fetch the first page
 * only.
 */
export interface CourseSessionRecord {
  id: string
  scheduledAt: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED'
  justificationText?: string | null
}

export function useMyCourseHistory(courseId: string | undefined, from?: string, to?: string) {
  return useQuery({
    queryKey: ['attendance', 'me', 'course', courseId, { from, to }],
    queryFn: async (): Promise<{
      overall: {
        total: number
        present: number
        late: number
        absent: number
        justified: number
        attendancePct: number
      }
      sessions: CourseSessionRecord[]
    }> => {
      const { data } = await apiClient.get<{
        overall: {
          total: number
          present: number
          late: number
          absent: number
          justified: number
          attendancePct: number
        }
        sessions: CourseSessionRecord[]
      }>(`/me/courses/${courseId}/attendance`, {
        params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
      })
      return data
    },
    enabled: Boolean(courseId),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type { StudentAttendanceSummary } from '@asistencia/shared'

const summaryKey = ['student', 'attendance-summary'] as const

export function useStudentAttendanceSummary() {
  return useQuery({
    queryKey: summaryKey,
    queryFn: async (): Promise<StudentAttendanceSummary> => {
      const { data } = await apiClient.get<StudentAttendanceSummary>('/students/me/attendance')
      return data
    },
    staleTime: 60_000,
  })
}

const absencesKey = ['student', 'recent-absences'] as const
export function useRecentAbsences(limit = 5) {
  return useQuery({
    queryKey: [...absencesKey, { limit }],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: Array<{
          id: string
          courseId: string
          courseName: string
          recordedAt: string
          status: 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED'
        }>
      }>('/students/me/attendance', {
        params: { statuses: 'ABSENT,LATE', limit },
      })
      return data.data
    },
    staleTime: 60_000,
  })
}

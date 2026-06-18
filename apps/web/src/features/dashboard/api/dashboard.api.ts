import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type { PaginatedResponse, User, Course, StudentAttendanceSummary } from '@asistencia/shared'

const dashboardKey = ['dashboard', 'institution-admin'] as const

export interface InstitutionAdminKpis {
  totalUsers: number
  totalStudents: number
  totalTeachers: number
  totalCourses: number
  todaysAttendance: number
}

export function useInstitutionAdminKpis() {
  return useQuery({
    queryKey: dashboardKey,
    queryFn: async (): Promise<InstitutionAdminKpis> => {
      // The backend doesn't yet expose a single dashboard endpoint; we
      // approximate from list endpoints. Each is a single small query.
      const [users, courses] = await Promise.all([
        apiClient
          .get<PaginatedResponse<User>>('/users', { params: { limit: 1 } })
          .then((r) => r.data.data.length)
          .catch(() => 0),
        apiClient
          .get<PaginatedResponse<Course>>('/courses', { params: { limit: 1 } })
          .then((r) => r.data.data.length)
          .catch(() => 0),
      ])
      return {
        totalUsers: users,
        totalStudents: 0, // until /students/stats ships
        totalTeachers: 0,
        totalCourses: courses,
        todaysAttendance: 0, // until /attendance/today/stats ships
      }
    },
    staleTime: 60_000,
  })
}

const activityKey = ['dashboard', 'institution-admin', 'activity'] as const
export interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  actorUserId: string | null
  createdAt: string
}
export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: [...activityKey, { limit }],
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data } = await apiClient.get<PaginatedResponse<AuditEntry>>('/audit', {
        params: { limit },
      })
      return data.data
    },
    staleTime: 30_000,
  })
}

// Re-export for the dashboard component.
export type { StudentAttendanceSummary }

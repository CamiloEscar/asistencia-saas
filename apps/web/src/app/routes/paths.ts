/**
 * Centralised route paths. Use these constants instead of hard-coded
 * strings so a future rename is a single edit. Routes are kept flat —
 * nested routes are computed by concatenation (e.g. `/courses/${id}`).
 */
export const Paths = {
  // Public
  login: '/login',
  forgotPassword: '/forgot-password',
  setPassword: '/set-password',

  // Protected (role-specific landing)
  dashboard: '/dashboard',
  today: '/today', // Teacher
  me: '/me', // Student
  admin: '/admin', // Super admin

  // Management
  institutions: '/institutions',
  institutionNew: '/institutions/new',
  institutionDetail: (id: string) => `/institutions/${id}`,
  institutionEdit: (id: string) => `/institutions/${id}/edit`,

  users: '/users',
  userNew: '/users/new',
  userDetail: (id: string) => `/users/${id}`,
  userEdit: (id: string) => `/users/${id}/edit`,

  teachers: '/teachers',

  students: '/students',
  studentNew: '/students/new',
  studentDetail: (id: string) => `/students/${id}`,
  studentEdit: (id: string) => `/students/${id}/edit`,
  studentsBulkImport: '/students/bulk',

  subjects: '/subjects',
  subjectNew: '/subjects/new',
  subjectEdit: (id: string) => `/subjects/${id}/edit`,

  courses: '/courses',
  courseNew: '/courses/new',
  courseDetail: (id: string) => `/courses/${id}`,
  courseEdit: (id: string) => `/courses/${id}/edit`,

  // Attendance (teacher)
  takeAttendance: (sessionId: string) => `/attendance/take/${sessionId}`,
  editAttendance: (sessionId: string) => `/sessions/${sessionId}/edit-attendance`,
  attendanceHistory: '/attendance/history',
  attendanceTake: '/attendance/take',

  // History (student)
  myAttendance: '/me/attendance',
  myCourse: (courseId: string) => `/me/courses/${courseId}`,

  // Profile
  profile: '/profile',
  settings: '/settings',

  // Errors
  forbidden: '/403',
} as const

/**
 * Returns the canonical landing path for a given role. Used by
 * `LoginPage` (post-login redirect) and `RequireAuth` (fallback).
 */
export function landingPathForRole(
  role: 'SUPER_ADMIN' | 'INSTITUTION_ADMIN' | 'TEACHER' | 'STUDENT' | null | undefined,
): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return Paths.admin
    case 'INSTITUTION_ADMIN':
      return Paths.dashboard
    case 'TEACHER':
      return Paths.today
    case 'STUDENT':
      return Paths.me
    default:
      return Paths.login
  }
}

/**
 * Attendance status — 4 states. Mirrors Prisma enum `AttendanceStatus`.
 *
 * Used by:
 *  - Backend: `apps/api/src/modules/attendance/...`
 *  - Frontend: `apps/web/src/features/attendance/...` (chips, badges, filters)
 */
export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  JUSTIFIED: 'JUSTIFIED',
} as const

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus]

export const attendanceStatusValues = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.ABSENT,
  AttendanceStatus.LATE,
  AttendanceStatus.JUSTIFIED,
] as const

/** Spanish labels for UI display. */
export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Asistió',
  ABSENT: 'Ausente',
  LATE: 'Tardanza',
  JUSTIFIED: 'Justificado',
}

/** Color hint for badges (Tailwind class). Used by StatusChip / Badge variants. */
export const attendanceStatusColor: Record<
  AttendanceStatus,
  'success' | 'destructive' | 'warning' | 'info'
> = {
  PRESENT: 'success',
  ABSENT: 'destructive',
  LATE: 'warning',
  JUSTIFIED: 'info',
}

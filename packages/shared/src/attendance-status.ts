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

// NOTE: Spanish labels previously lived here as `attendanceStatusLabels`. They
// have been moved to `apps/web/src/locales/es/common.json` under
// `attendanceStatus.*` and are rendered via `t('attendanceStatus.<STATUS>')`.

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

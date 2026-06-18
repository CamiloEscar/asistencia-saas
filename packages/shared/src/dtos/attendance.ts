import { z } from 'zod'
import { attendanceStatusValues } from '../attendance-status'

/** Bulk attendance mark: one record per student. */
export const attendanceMarkRecordSchema = z.object({
  studentId: z.string().uuid('ID de estudiante inválido'),
  status: z.enum(attendanceStatusValues).default('PRESENT'),
  justificationText: z.string().max(500, 'Máximo 500 caracteres').optional(),
})
export type AttendanceMarkRecord = z.infer<typeof attendanceMarkRecordSchema>

export const attendanceMarkRequestSchema = z.object({
  records: z.array(attendanceMarkRecordSchema).min(1, 'Al menos un registro'),
})
export type AttendanceMarkRequest = z.infer<typeof attendanceMarkRequestSchema>

export const attendanceMarkResponseSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
  errors: z.array(
    z.object({
      studentId: z.string().uuid().optional(),
      message: z.string(),
    }),
  ),
})
export type AttendanceMarkResponse = z.infer<typeof attendanceMarkResponseSchema>

/** Modify: same shape as mark. BE enforces same-day rule for teachers. */
export const attendanceModifyRequestSchema = attendanceMarkRequestSchema
export type AttendanceModifyRequest = z.infer<typeof attendanceModifyRequestSchema>

/** List filter params. */
export const listAttendanceQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sessionId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.enum(attendanceStatusValues).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>

/** One attendance record in list responses. */
export const attendanceRecordSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  studentName: z.string().optional(),
  courseName: z.string().optional(),
  status: z.enum(attendanceStatusValues),
  justificationText: z.string().nullable().optional(),
  recordedAt: z.coerce.date(),
})
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>

/**
 * Class session (one meeting of a course). Teacher's "today" dashboard
 * queries these.
 */
export const sessionStatusValues = ['SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'] as const
export const SessionStatus = {
  SCHEDULED: 'SCHEDULED',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus]

/** Spanish labels for session status (used in FE). */
export const sessionStatusLabels: Record<SessionStatus, string> = {
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
}

export const classSessionSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  courseName: z.string().optional(),
  scheduledAt: z.coerce.date(),
  durationMin: z.number().int(),
  topic: z.string().nullable().optional(),
  status: z.enum(sessionStatusValues),
  enrolledCount: z.number().int().default(0),
  attendanceTaken: z.boolean().default(false),
})
export type ClassSession = z.infer<typeof classSessionSchema>

/** Teacher today summary: list of sessions + counts. */
export const teacherTodaySummarySchema = z.object({
  totalSessions: z.number().int(),
  sessionsWithAttendance: z.number().int(),
  sessions: z.array(classSessionSchema),
})
export type TeacherTodaySummary = z.infer<typeof teacherTodaySummarySchema>

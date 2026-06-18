import { z } from 'zod'

/** Course = subject + semester + schedule + dates. */
export const scheduleEntrySchema = z
  .object({
    day: z.number().int().min(0).max(6), // 0=Sunday, 6=Saturday
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm'),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'La hora de fin debe ser posterior a la de inicio',
    path: ['endTime'],
  })
export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>

export const createCourseRequestSchema = z.object({
  subjectId: z.string().uuid('ID de materia inválido'),
  code: z
    .string()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(20, 'El código debe tener como máximo 20 caracteres'),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  semester: z.string().min(2).max(20),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  schedule: z.array(scheduleEntrySchema).min(1, 'Al menos un bloque semanal'),
  defaultSessionDurationMin: z.number().int().min(15).max(480).default(80),
  teacherIds: z.array(z.string().uuid()).default([]),
  studentIds: z.array(z.string().uuid()).default([]),
})
export type CreateCourseRequest = z.infer<typeof createCourseRequestSchema>

export const updateCourseRequestSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  schedule: z.array(scheduleEntrySchema).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  defaultSessionDurationMin: z.number().int().min(15).max(480).optional(),
})
export type UpdateCourseRequest = z.infer<typeof updateCourseRequestSchema>

export const listCoursesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  semester: z.string().optional(),
  subjectId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
})
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>

/** Course response — minimal subset used by FE list pages. */
export const courseSchema = z.object({
  id: z.string().uuid(),
  subjectId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  semester: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  enrolledCount: z.number().int().default(0),
  teacherCount: z.number().int().default(0),
})
export type Course = z.infer<typeof courseSchema>

/** Enrollment helpers. */
export const enrollStudentsRequestSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Al menos un estudiante'),
})
export type EnrollStudentsRequest = z.infer<typeof enrollStudentsRequestSchema>

export const assignTeachersRequestSchema = z.object({
  teacherIds: z.array(z.string().uuid()).min(1, 'Al menos un profesor'),
})
export type AssignTeachersRequest = z.infer<typeof assignTeachersRequestSchema>

/** Per-course attendance summary (KPIs for the dashboard). */
export const courseAttendanceSummarySchema = z.object({
  total: z.number().int(),
  present: z.number().int(),
  absent: z.number().int(),
  late: z.number().int(),
  justified: z.number().int(),
  attendancePct: z.number().min(0).max(100),
})
export type CourseAttendanceSummary = z.infer<typeof courseAttendanceSummarySchema>

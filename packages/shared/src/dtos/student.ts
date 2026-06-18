import { z } from 'zod'

/** Create student = create user with role=STUDENT + student fields. */
export const createStudentRequestSchema = z.object({
  email: z.string().email('Email inválido'),
  fullName: z.string().min(2, 'Nombre demasiado corto').max(200),
  legajo: z
    .string()
    .min(3, 'El legajo debe tener al menos 3 caracteres')
    .max(20, 'El legajo debe tener como máximo 20 caracteres'),
  phone: z.string().max(30).optional(),
  birthDate: z.coerce.date().optional(),
  career: z.string().max(100).optional(),
  sendActivationLink: z.boolean().default(true),
})
export type CreateStudentRequest = z.infer<typeof createStudentRequestSchema>

export const updateStudentRequestSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  legajo: z.string().min(3).max(20).optional(),
  phone: z.string().max(30).nullable().optional(),
  birthDate: z.coerce.date().nullable().optional(),
  career: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
})
export type UpdateStudentRequest = z.infer<typeof updateStudentRequestSchema>

export const listStudentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
})
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>

/**
 * Bulk import result (returned by POST /api/students/bulk).
 * For ≤500 rows: sync response. For >500 rows: 202 + jobId, then FE polls.
 */
export const bulkImportRowErrorSchema = z.object({
  row: z.number().int(),
  field: z.string().optional(),
  message: z.string(),
})
export type BulkImportRowError = z.infer<typeof bulkImportRowErrorSchema>

export const bulkImportResponseSchema = z.object({
  totalRows: z.number().int(),
  validRows: z.number().int(),
  willCreate: z.number().int(),
  willSkip: z.number().int(),
  errors: z.array(bulkImportRowErrorSchema),
  /** Optional jobId when async (BullMQ). */
  jobId: z.string().optional(),
  status: z
    .enum(['preview', 'committed', 'pending', 'processing', 'completed', 'failed'])
    .optional(),
})
export type BulkImportResponse = z.infer<typeof bulkImportResponseSchema>

/** Per-course + overall attendance summary (used by StudentDashboard). */
export const studentAttendanceSummarySchema = z.object({
  overall: z.object({
    total: z.number().int(),
    present: z.number().int(),
    absent: z.number().int(),
    late: z.number().int(),
    justified: z.number().int(),
    attendancePct: z.number().min(0).max(100),
  }),
  byCourse: z.array(
    z.object({
      courseId: z.string().uuid(),
      courseName: z.string(),
      total: z.number().int(),
      present: z.number().int(),
      absent: z.number().int(),
      late: z.number().int(),
      justified: z.number().int(),
      attendancePct: z.number().min(0).max(100),
      lastAttendedAt: z.string().nullable(),
    }),
  ),
})
export type StudentAttendanceSummary = z.infer<typeof studentAttendanceSummarySchema>

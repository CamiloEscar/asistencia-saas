import { z } from 'zod'

/**
 * AttendanceSummaryQueryDto — GET /api/attendance/summary filters.
 *
 * XOR contract (per spec REQ-ATT-005):
 *   - Pass `courseId` to get a course summary.
 *   - Pass `studentId` to get a student summary (optionally with
 *     `studentCourseId` to scope to a single course).
 *   - Pass `teacherId` to get a teacher's cross-course summary.
 *
 * `dateFrom` and `dateTo` constrain the time window; both default
 * to "all-time" when omitted.
 */
export const AttendanceSummaryQueryDtoSchema = z
  .object({
    courseId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
    studentCourseId: z.string().uuid().optional(),
    teacherId: z.string().uuid().optional(),
    dateFrom: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'dateFrom must be a valid ISO date' })
      .optional(),
    dateTo: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'dateTo must be a valid ISO date' })
      .optional(),
  })
  .refine(
    (q) => [q.courseId, q.studentId, q.teacherId].filter((x) => x !== undefined).length <= 1,
    {
      message: 'Pass exactly one of courseId, studentId, or teacherId',
    },
  )

export type AttendanceSummaryQueryDto = z.infer<typeof AttendanceSummaryQueryDtoSchema>

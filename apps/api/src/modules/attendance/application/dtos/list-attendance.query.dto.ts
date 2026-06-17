import { z } from 'zod'
import { AttendanceStatusSchema } from '../../domain/value-objects/attendance-status.vo'

/**
 * ListAttendanceQueryDto — GET /api/attendance filters (REQ-ATT-003).
 * All filters are optional and combine with AND. Pagination is
 * cursor-based (REQ-X-002): `cursor` is the id of the last item
 * the client saw, `limit` is capped at 100.
 */
export const ListAttendanceQueryDtoSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  courseId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  status: AttendanceStatusSchema.optional(),
  dateFrom: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'dateFrom must be a valid ISO date' })
    .optional(),
  dateTo: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'dateTo must be a valid ISO date' })
    .optional(),
})

export type ListAttendanceQueryDto = z.infer<typeof ListAttendanceQueryDtoSchema>

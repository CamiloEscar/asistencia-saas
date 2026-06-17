import { z } from 'zod'
import {
  ATTENDANCE_STATUSES,
  AttendanceStatusSchema,
} from '../../domain/value-objects/attendance-status.vo'
import { JustificationTextSchema } from '../../domain/value-objects/justification-text.vo'

/**
 * MarkAttendanceDto — input for the bulk mark endpoint
 * `POST /api/attendance` (REQ-ATT-001).
 *
 *   - `courseId`: the course the teacher is taking attendance for.
 *   - `date`: ISO date string (YYYY-MM-DD or full ISO). Interpreted
 *     in the institution's timezone by the use case.
 *   - `records`: per-student state. `status` defaults to PRESENT
 *     when omitted (REQ-ATT-001-06). `justificationText` is
 *     optional; the VO caps it at 500 chars.
 *   - `sessionNotes`: free-form note attached to the session
 *     (becomes the `topic` column on `class_sessions`).
 *   - `sessionDurationMin`: optional override; defaults to the
 *     course's `defaultSessionDurationMin` (80 min).
 */
export const MarkAttendanceDtoSchema = z.object({
  courseId: z.string().uuid(),
  date: z
    .string()
    .min(1, 'date is required')
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'date must be a valid ISO date' }),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: AttendanceStatusSchema.optional(),
        justificationText: JustificationTextSchema,
      }),
    )
    .min(1, 'At least one record is required'),
  sessionNotes: z.string().trim().max(500).optional(),
  sessionDurationMin: z.coerce.number().int().min(15).max(480).optional(),
})

export type MarkAttendanceDto = z.infer<typeof MarkAttendanceDtoSchema>

/** Re-export for ergonomics — `ATTENDANCE_STATUSES` is used by tests
 *  and the FE to render the chip cycle. */
export { ATTENDANCE_STATUSES }

import { z } from 'zod'
import { AttendanceStatusSchema } from '../../domain/value-objects/attendance-status.vo'
import { JustificationTextSchema } from '../../domain/value-objects/justification-text.vo'

/**
 * ModifyAttendanceDto — PATCH /api/attendance/:id. All fields are
 * optional; only the ones the caller sent are updated. The use
 * case rejects the call if the resulting update would be a no-op
 * (handled by Prisma's update; we don't add a separate check).
 */
export const ModifyAttendanceDtoSchema = z
  .object({
    status: AttendanceStatusSchema.optional(),
    justificationText: JustificationTextSchema,
    evidenceUrl: z.string().url().nullable().optional(),
  })
  .strict()

export type ModifyAttendanceDto = z.infer<typeof ModifyAttendanceDtoSchema>

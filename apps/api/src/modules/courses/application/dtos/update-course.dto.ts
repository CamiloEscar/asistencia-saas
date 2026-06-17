import { z } from 'zod'
import { CreateCourseDtoSchema, ScheduleSchema } from './create-course.dto'

/**
 * Update-course DTO. `code` is NOT in the schema — it's
 * immutable per spec REQ-COURSE-004-02. We re-export the schedule
 * schema (without the `code`, `subjectId`, `semester` fields
 * required) so callers can PATCH any subset of fields.
 */
export const UpdateCourseDtoSchema = z
  .object({
    name: CreateCourseDtoSchema.shape.name,
    description: CreateCourseDtoSchema.shape.description,
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    schedule: ScheduleSchema.optional(),
    defaultSessionDurationMin: CreateCourseDtoSchema.shape.defaultSessionDurationMin,
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.schedule !== undefined ||
      data.defaultSessionDurationMin !== undefined,
    { message: 'At least one field must be provided' },
  )

export type UpdateCourseDto = z.infer<typeof UpdateCourseDtoSchema>

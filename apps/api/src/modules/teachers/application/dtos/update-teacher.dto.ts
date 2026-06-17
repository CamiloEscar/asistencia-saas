import { z } from 'zod'

/**
 * Update-teacher DTO. Role is locked to `TEACHER` (REQ-TEACHER-003)
 * so the schema does not expose `role`.
 */
export const UpdateTeacherDtoSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().toLowerCase().email('Invalid email format').optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    legajo: z.string().trim().min(1).max(20).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.email !== undefined ||
      data.phone !== undefined ||
      data.legajo !== undefined ||
      data.isActive !== undefined,
    { message: 'At least one field must be provided' },
  )

export type UpdateTeacherDto = z.infer<typeof UpdateTeacherDtoSchema>

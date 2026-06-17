import { z } from 'zod'

/**
 * Update-student DTO. Role is locked to `STUDENT` (no role change
 * via this endpoint). All fields are optional; the use case
 * enforces at least one field via the repo's update method
 * (the `refine` below validates the request shape).
 *
 * Legajo and email changes re-validate uniqueness within the
 * institution (REQ-STUDENT-003-02).
 */
export const UpdateStudentDtoSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email format')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    legajo: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/)
      .optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    birthDate: z.coerce.date().nullable().optional(),
    career: z.string().trim().max(100).nullable().optional(),
  })
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.email !== undefined ||
      data.legajo !== undefined ||
      data.phone !== undefined ||
      data.birthDate !== undefined ||
      data.career !== undefined,
    { message: 'At least one field must be provided' },
  )

export type UpdateStudentDto = z.infer<typeof UpdateStudentDtoSchema>

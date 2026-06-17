import { z } from 'zod'
import { INSTITUTION_ASSIGNABLE_ROLES } from './create-user.dto'

/**
 * Update-user DTO. Role can be changed but constrained to the
 * institution-assignable set (no SUPER_ADMIN promotion). Self-role
 * change is rejected by the use case (REQ-USER-004-03).
 */
export const UpdateUserDtoSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().toLowerCase().email('Invalid email format').optional(),
    role: z.enum(INSTITUTION_ASSIGNABLE_ROLES).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    legajo: z.string().trim().min(1).max(20).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.email !== undefined ||
      data.role !== undefined ||
      data.phone !== undefined ||
      data.legajo !== undefined ||
      data.isActive !== undefined,
    { message: 'At least one field must be provided' },
  )

export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>

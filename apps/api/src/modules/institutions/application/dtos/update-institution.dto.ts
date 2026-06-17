import { z } from 'zod'

/**
 * Update-institution DTO. All fields are optional. Subdomain is
 * immutable (caller enforces — see PATCH controller) and is therefore
 * not part of this schema.
 */
export const UpdateInstitutionDtoSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    plan: z.string().trim().max(50).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    logoUrl: z.string().url().nullable().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.plan !== undefined ||
      data.timezone !== undefined ||
      data.logoUrl !== undefined,
    { message: 'At least one field must be provided' },
  )

export type UpdateInstitutionDto = z.infer<typeof UpdateInstitutionDtoSchema>

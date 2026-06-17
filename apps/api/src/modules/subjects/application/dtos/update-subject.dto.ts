import { z } from 'zod'

/**
 * Update-subject DTO. `code` is NOT in the schema — it's
 * immutable per spec REQ-SUBJECT-003-02. The refine() ensures
 * at least one field is provided.
 */
export const UpdateSubjectDtoSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'At least one field must be provided',
  })

export type UpdateSubjectDto = z.infer<typeof UpdateSubjectDtoSchema>

import { z } from 'zod'

/**
 * Create-subject DTO. Code format: uppercase alphanumeric +
 * hyphens, 2-20 chars (REQ-SUBJECT-005-01). We enforce uppercase
 * at the schema level so the caller can submit `mat-101` and we
 * store `MAT-101`.
 */
export const CreateSubjectDtoSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code must be at most 20 characters')
    .regex(/^[A-Za-z0-9-]+$/, 'Code must be alphanumeric with optional hyphens')
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export type CreateSubjectDto = z.infer<typeof CreateSubjectDtoSchema>

export const CreateSubjectResponseSchema = z.object({
  subject: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
  }),
})

export type CreateSubjectResponse = z.infer<typeof CreateSubjectResponseSchema>

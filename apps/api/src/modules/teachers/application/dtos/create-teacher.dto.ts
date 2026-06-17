import { z } from 'zod'

/**
 * Create-teacher DTO. Role is forced to `TEACHER` (REQ-TEACHER-002-02)
 * so the schema doesn't expose a `role` field — the controller passes
 * `role: 'TEACHER'` explicitly when calling the use case.
 */
export const CreateTeacherDtoSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  password: z.string().min(8).max(128).optional(),
  fullName: z.string().trim().min(1, 'Full name is required').max(200),
  legajo: z.string().trim().min(1).max(20).optional(),
  phone: z.string().trim().max(30).optional(),
  sendActivationLink: z.boolean().default(false),
})

export type CreateTeacherDto = z.infer<typeof CreateTeacherDtoSchema>

export const CreateTeacherResponseSchema = z.object({
  teacher: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.literal('TEACHER'),
    isActive: z.boolean(),
    legajo: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  temporaryPassword: z.string().optional(),
  setPasswordLink: z.string().optional(),
})

export type CreateTeacherResponse = z.infer<typeof CreateTeacherResponseSchema>

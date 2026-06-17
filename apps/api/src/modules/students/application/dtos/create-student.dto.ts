import { z } from 'zod'

/**
 * Create-student DTO. Mirrors `CreateUserDtoSchema` from the users
 * module but without `role` (locked to STUDENT) and with student-
 * specific fields (legajo, phone, birthDate, career).
 *
 * `email` is optional in the create DTO — if absent, we derive a
 * deterministic placeholder from the legajo. The student can set
 * their real email at first login via the set-password flow.
 *
 * `password` is optional. If absent, we generate a 16-char random
 * password and return it in the response (no SMTP in MVP).
 */
export const CreateStudentDtoSchema = z.object({
  legajo: z
    .string()
    .trim()
    .min(3, 'Legajo must be at least 3 characters')
    .max(30, 'Legajo must be at most 30 characters')
    .regex(/^[A-Za-z0-9-]+$/, 'Legajo must be alphanumeric (with optional hyphens)'),
  fullName: z.string().trim().min(1, 'Full name is required').max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email format')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  birthDate: z.coerce.date().optional(),
  career: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  password: z.string().min(8).max(128).optional(),
  sendActivationLink: z.boolean().default(false),
})

export type CreateStudentDto = z.infer<typeof CreateStudentDtoSchema>

export const CreateStudentResponseSchema = z.object({
  student: z.object({
    id: z.string().uuid(),
    email: z.string(),
    fullName: z.string(),
    role: z.literal('STUDENT'),
    isActive: z.boolean(),
    legajo: z.string().nullable(),
    phone: z.string().nullable(),
    birthDate: z.coerce.date().nullable(),
    career: z.string().nullable(),
  }),
  temporaryPassword: z.string().optional(),
  setPasswordLink: z.string().optional(),
})

export type CreateStudentResponse = z.infer<typeof CreateStudentResponseSchema>

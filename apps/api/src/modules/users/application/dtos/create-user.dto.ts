import { z } from 'zod'

/**
 * Roles an institution admin can assign. SUPER_ADMIN is reserved
 * for the bootstrap and is never assignable from the
 * institution-scoped endpoints (REQ-USER-004-02).
 */
export const ASSIGNABLE_ROLES = ['ADMIN', 'TEACHER', 'STUDENT'] as const

export const CreateUserDtoSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  // Optional: if absent, we generate a 16-char random password and
  // return it in the response (no SMTP in MVP).
  password: z.string().min(8).max(128).optional(),
  fullName: z.string().trim().min(1, 'Full name is required').max(200),
  role: z.enum(ASSIGNABLE_ROLES),
  // Optional student-specific fields
  legajo: z.string().trim().min(1).max(20).optional(),
  phone: z.string().trim().max(30).optional(),
  birthDate: z.coerce.date().optional(),
  career: z.string().trim().max(100).optional(),
  // If true, generate a set-password signed link in the response
  sendActivationLink: z.boolean().default(false),
})

export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>

export const CreateUserResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']),
    legajo: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  // Auto-generated password, returned if no password was provided.
  // The FE shows it once to the admin so they can communicate it to
  // the new user (no SMTP in MVP).
  temporaryPassword: z.string().optional(),
  // Signed link (purpose: set_password) for the user to set their
  // own password. Returned when sendActivationLink: true.
  setPasswordLink: z.string().optional(),
})

export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>

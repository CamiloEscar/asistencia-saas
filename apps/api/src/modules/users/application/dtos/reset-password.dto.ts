import { z } from 'zod'

/**
 * Reset-password DTO. Admin resets a user's password, which
 * returns a new temporary password (no SMTP in MVP).
 */
export const ResetPasswordResponseSchema = z.object({
  temporaryPassword: z.string(),
  // Optional: if the FE wants to redirect the user to a "set new
  // password" page, we also return a signed link.
  setPasswordLink: z.string().optional(),
})

export type ResetPasswordResponse = z.infer<typeof ResetPasswordResponseSchema>

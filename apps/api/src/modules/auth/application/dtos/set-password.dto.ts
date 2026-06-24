import { z } from 'zod'

/**
 * Password policy (per design §8.5):
 *   - minimum 10 characters
 *   - at least one lowercase letter
 *   - at least one uppercase letter
 *   - at least one digit
 *   - at least one special character (from a conservative set)
 *
 * We enforce policy on set-password only — login accepts existing
 * passwords as-is (backward compat with seeded users, imported users).
 */
export const PasswordPolicySchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password too long')
  .refine((s) => /[a-z]/.test(s), 'Password must contain a lowercase letter')
  .refine((s) => /[A-Z]/.test(s), 'Password must contain an uppercase letter')
  .refine((s) => /[0-9]/.test(s), 'Password must contain a digit')
  .refine(
    (s) => /[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?`]/.test(s),
    'Password must contain a special character',
  )

/**
 * Set-password (consume) DTO. The token is the signed JWT from the
 * activation link; the new password is validated against the policy.
 */
export const SetPasswordDtoSchema = z.object({
  token: z.string().min(1),
  newPassword: PasswordPolicySchema,
})

export type SetPasswordDto = z.infer<typeof SetPasswordDtoSchema>

export const SetPasswordResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
})

export type SetPasswordResponse = z.infer<typeof SetPasswordResponseSchema>

/**
 * Set-password issue DTO (admin side). INSTITUTION_ADMIN or SUPER_ADMIN
 * can request a set-password link for any user. Returns the signed JWT
 * directly (no SMTP in MVP — see spec REQ-AUTH-008).
 */
export const SetPasswordIssueDtoSchema = z.object({
  userId: z.string().uuid(),
})

export type SetPasswordIssueDto = z.infer<typeof SetPasswordIssueDtoSchema>

export const SetPasswordIssueResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string(), // ISO-8601
  // Convenience for dev: include the full link so the admin can copy it.
  // In production this would be sent via SMTP; we return it directly.
  resetUrl: z.string().optional(),
})

export type SetPasswordIssueResponse = z.infer<typeof SetPasswordIssueResponseSchema>
export type SetPasswordIssueInput = z.infer<typeof SetPasswordIssueDtoSchema>

import { z } from 'zod'

/**
 * Forgot-password DTO. Returns a generic message regardless of whether
 * the email exists, to prevent user enumeration (REQ-AUTH-008-02).
 */
export const ForgotPasswordDtoSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  tenantSubdomain: z.string().trim().toLowerCase(),
})

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDtoSchema>

export const ForgotPasswordResponseSchema = z.object({
  message: z.literal('If the email exists, a reset link has been generated'),
  // Dev convenience: returned to the admin so they can copy/paste it.
  // In production this would only be in the response if the email matched.
  resetUrl: z.string().optional(),
})

export type ForgotPasswordResponse = z.infer<typeof ForgotPasswordResponseSchema>

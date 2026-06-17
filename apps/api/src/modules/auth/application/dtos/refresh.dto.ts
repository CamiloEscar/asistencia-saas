import { z } from 'zod'

/**
 * Refresh DTO. Token can come from the cookie OR the body — if both are
 * present, the body wins (so E2E tests can drive the flow without having
 * to parse cookies). For production traffic, the FE interceptor prefers
 * the cookie and only sends the body field when explicitly refreshing
 * (e.g., from the set-password flow's auto-login).
 */
export const RefreshDtoSchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

export type RefreshDto = z.infer<typeof RefreshDtoSchema>

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
})

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>

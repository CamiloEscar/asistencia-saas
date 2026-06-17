import { z } from 'zod'

/**
 * Login DTO. Subdomain is read from the X-Tenant-Subdomain header by
 * the middleware before this DTO is validated; we still accept it in
 * body as an override for E2E tests that want to skip header injection.
 */
export const LoginDtoSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
  subdomain: z.string().trim().toLowerCase().optional(),
})

export type LoginDto = z.infer<typeof LoginDtoSchema>

/**
 * Login response shape. Refresh token is also set as a HttpOnly cookie;
 * we return it in the body too so E2E tests can drive the flow without
 * having to parse cookies.
 */
export const LoginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'TEACHER', 'STUDENT']),
    institutionId: z.string().uuid().nullable(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
})

export type LoginResponse = z.infer<typeof LoginResponseSchema>

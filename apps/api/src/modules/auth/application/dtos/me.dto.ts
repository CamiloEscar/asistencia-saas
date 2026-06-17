import { z } from 'zod'

/**
 * Response shape for `GET /api/v1/auth/me`. Used by the FE to hydrate the
 * auth store after a page reload (REQ-FE-AUTH-006).
 */
export const MeResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'TEACHER', 'STUDENT']),
    institutionId: z.string().uuid().nullable(),
  }),
  tenant: z.object({
    id: z.string().uuid(),
    subdomain: z.string(),
    timezone: z.string(),
  }),
})

export type MeResponse = z.infer<typeof MeResponseSchema>

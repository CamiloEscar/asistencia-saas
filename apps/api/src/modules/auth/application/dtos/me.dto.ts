import { z } from 'zod'

export const MeResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']),
  }),
})

export type MeResponse = z.infer<typeof MeResponseSchema>

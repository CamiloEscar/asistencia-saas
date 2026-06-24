import { z } from 'zod'

export const LoginDtoSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
})

export type LoginDto = z.infer<typeof LoginDtoSchema>

export const LoginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
})

export type LoginResponse = z.infer<typeof LoginResponseSchema>

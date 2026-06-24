import { z } from 'zod'
import { userRoleValues } from '../roles'

export const loginRequestSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(1, 'Contraseña requerida'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(userRoleValues),
  }),
})
export type LoginResponse = z.infer<typeof loginResponseSchema>

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Email inválido'),
})
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>

export const forgotPasswordResponseSchema = z.object({
  message: z.string(),
  resetUrl: z.string().url().optional(),
})
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>

export const setPasswordRequestSchema = z
  .object({
    token: z.string().min(10, 'Token inválido'),
    newPassword: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un dígito')
      .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial'),
    confirmPassword: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })
export type SetPasswordRequest = z.infer<typeof setPasswordRequestSchema>

export const setPasswordResponseSchema = loginResponseSchema
export type SetPasswordResponse = z.infer<typeof setPasswordResponseSchema>

/**
 * Me response: GET /auth/me → current user (no institution context in single-tenant).
 */
export const meResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(userRoleValues),
  }),
})
export type MeResponse = z.infer<typeof meResponseSchema>

export const refreshResponseSchema = loginResponseSchema
export type RefreshResponse = z.infer<typeof refreshResponseSchema>

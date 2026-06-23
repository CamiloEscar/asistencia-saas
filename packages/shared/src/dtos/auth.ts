import { z } from 'zod'
import { userRoleValues } from '../roles'

/**
 * Login request: { email, password }. Sent to POST /auth/login.
 * BE returns 200 with `{ user, institution? }` + sets HttpOnly cookies.
 */
export const loginRequestSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(1, 'Contraseña requerida'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

/** Response body from POST /auth/login. */
export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(userRoleValues),
  }),
})
export type LoginResponse = z.infer<typeof loginResponseSchema>

/**
 * Forgot-password request. Always returns 200 (no enumeration). MVP
 * returns the resetUrl in the response body since there is no SMTP.
 */
export const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Email inválido'),
})
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>

export const forgotPasswordResponseSchema = z.object({
  message: z.string(),
  resetUrl: z.string().url().optional(),
})
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>

/**
 * Set-password request (token-based, no auth required).
 * Used by the activation flow: email link → set-password page.
 */
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

/** Response from set-password: same shape as login (auto-login). */
export const setPasswordResponseSchema = loginResponseSchema
export type SetPasswordResponse = z.infer<typeof setPasswordResponseSchema>

/**
 * Me response: GET /auth/me → current user + tenant context.
 */
export const meResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(userRoleValues),
  }),
  institution: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      subdomain: z.string(),
      timezone: z.string(),
    })
    .nullable(),
})
export type MeResponse = z.infer<typeof meResponseSchema>

/**
 * Refresh response: POST /auth/refresh returns a new pair.
 * The body is the same as login (FE re-populates the user).
 */
export const refreshResponseSchema = loginResponseSchema
export type RefreshResponse = z.infer<typeof refreshResponseSchema>

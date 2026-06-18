import { z } from 'zod'
import { userRoleValues } from '../roles'

/** User create: { email, fullName, role, password?, sendActivationLink? }. */
export const createUserRequestSchema = z.object({
  email: z.string().email('Email inválido'),
  fullName: z.string().min(2, 'Nombre demasiado corto').max(200),
  role: z.enum(userRoleValues),
  legajo: z.string().min(3).max(20).optional(),
  phone: z.string().max(30).optional(),
  birthDate: z.coerce.date().optional(),
  career: z.string().max(100).optional(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/)
    .optional(),
  sendActivationLink: z.boolean().default(true),
})
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>

/** User update: partial of create (role and email are typically immutable). */
export const updateUserRequestSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  phone: z.string().max(30).nullable().optional(),
  birthDate: z.coerce.date().nullable().optional(),
  career: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
})
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>

/** Self profile update: { fullName?, currentPassword?, newPassword? }. */
export const updateMeRequestSchema = z
  .object({
    fullName: z.string().min(2).max(200).optional(),
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8)
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un dígito')
      .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial')
      .optional(),
  })
  .refine(
    (d) =>
      (d.currentPassword === undefined && d.newPassword === undefined) ||
      (!!d.currentPassword && !!d.newPassword),
    {
      message: 'Ambas contraseñas son requeridas para cambiar la contraseña',
      path: ['newPassword'],
    },
  )
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>

/** List query: adds role filter on top of common listQuerySchema. */
export const listUsersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(userRoleValues).optional(),
  isActive: z.coerce.boolean().optional(),
})
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

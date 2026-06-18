import { z } from 'zod'

/** Institution = tenant. Super-admin only endpoints. */
export const institutionStatusValues = ['ACTIVE', 'INACTIVE'] as const
export const institutionPlanValues = ['FREE', 'PRO', 'ENTERPRISE'] as const

export const createInstitutionRequestSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  subdomain: z
    .string()
    .min(3, 'El subdominio debe tener al menos 3 caracteres')
    .max(63, 'El subdominio debe tener como máximo 63 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones')
    .regex(/^[a-z0-9]/, 'Debe empezar con letra o número')
    .regex(/[a-z0-9]$/, 'Debe terminar con letra o número'),
  timezone: z.string().min(2).default('America/Argentina/Buenos_Aires'),
  plan: z.enum(institutionPlanValues).default('FREE'),
  adminEmail: z.string().email('Email del administrador inválido'),
  adminFullName: z.string().min(2).max(200),
  sendActivationLink: z.boolean().default(true),
})
export type CreateInstitutionRequest = z.infer<typeof createInstitutionRequestSchema>

export const updateInstitutionRequestSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  timezone: z.string().min(2).optional(),
  plan: z.enum(institutionPlanValues).optional(),
  logoUrl: z.string().url().nullable().optional(),
})
export type UpdateInstitutionRequest = z.infer<typeof updateInstitutionRequestSchema>

export const listInstitutionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(institutionStatusValues).optional(),
})
export type ListInstitutionsQuery = z.infer<typeof listInstitutionsQuerySchema>

export const institutionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subdomain: z.string(),
  status: z.enum(institutionStatusValues),
  plan: z.enum(institutionPlanValues),
  timezone: z.string(),
  logoUrl: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
})
export type Institution = z.infer<typeof institutionSchema>

/** Common IANA timezones used in the timezone picker (MVP subset). */
export const commonTimezones: Array<{ value: string; label: string }> = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
  { value: 'UTC', label: 'UTC' },
]

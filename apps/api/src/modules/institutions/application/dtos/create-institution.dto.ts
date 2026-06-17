import { z } from 'zod'

/**
 * Create-institution DTO. Validates the spec rules (REQ-INST-002,
 * REQ-INST-008). The `subdomain` rule is enforced by the
 * `SubdomainSchema` value object in the domain layer; we mirror it
 * here for fast 422 feedback at the controller boundary.
 */
export const CreateInstitutionDtoSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name too long'),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain must be at most 63 characters')
    .regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with optional hyphens')
    .refine((s) => !s.startsWith('-') && !s.endsWith('-'), {
      message: 'Subdomain cannot start or end with a hyphen',
    })
    .refine(
      (s) => !['www', 'api', 'admin', 'app', 'static', 'assets', 'cdn', 'auth', 'mail'].includes(s),
      'Subdomain is reserved',
    ),
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().max(100).optional(),
  country: z.string().trim().length(2, 'Country must be an ISO 3166-1 alpha-2 code').toUpperCase(),
  timezone: z.string().trim().min(1).default('America/Argentina/Buenos_Aires'),
  adminEmail: z.string().trim().toLowerCase().email('Invalid admin email format'),
  adminFullName: z.string().trim().min(1, 'Admin full name is required').max(200),
  plan: z.string().trim().max(50).default('FREE'),
})

export type CreateInstitutionDto = z.infer<typeof CreateInstitutionDtoSchema>

/**
 * Response shape returned after a successful create. Mirrors what
 * the FE needs to display the new institution card and the initial
 * admin's credentials (in MVP we generate a temporary password and
 * a set-password signed link — no SMTP).
 */
export const CreateInstitutionResponseSchema = z.object({
  institution: z.object({
    id: z.string().uuid(),
    name: z.string(),
    subdomain: z.string(),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    plan: z.string(),
    timezone: z.string(),
    logoUrl: z.string().nullable(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }),
  adminUser: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.literal('INSTITUTION_ADMIN'),
    temporaryPassword: z.string(),
  }),
  setPasswordLink: z.string().url(),
})

export type CreateInstitutionResponse = z.infer<typeof CreateInstitutionResponseSchema>

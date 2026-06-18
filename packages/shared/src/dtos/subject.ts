import { z } from 'zod'

/** Subject (materia) — code + name. Unique per institution. */
export const createSubjectRequestSchema = z.object({
  code: z
    .string()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(20, 'El código debe tener como máximo 20 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'Solo letras mayúsculas, números y guiones'),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
})
export type CreateSubjectRequest = z.infer<typeof createSubjectRequestSchema>

export const updateSubjectRequestSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
})
export type UpdateSubjectRequest = z.infer<typeof updateSubjectRequestSchema>

export const listSubjectsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})
export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>

/** Subject response (subset). */
export const subjectSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
})
export type Subject = z.infer<typeof subjectSchema>

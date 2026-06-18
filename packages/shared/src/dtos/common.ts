import { z } from 'zod'
import { userRoleValues } from '../roles'

/**
 * Generic cursor-paginated list response (per spec REQ-X-002).
 * `data` is the array of T; the FE uses `nextCursor` and `hasMore` to
 * implement infinite scroll.
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
export type PaginatedResponse<T> = {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

/** Common list query params. */
export const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})
export type ListQuery = z.infer<typeof listQuerySchema>

/** RFC 7807 problem+json shape (per spec REQ-X-001). */
export const problemJsonSchema = z.object({
  type: z.string().url().optional(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
})
export type ProblemJson = z.infer<typeof problemJsonSchema>

/** Generic user payload (subset of the full User record). */
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  role: z.enum(userRoleValues),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  legajo: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  career: z.string().nullable().optional(),
})
export type User = z.infer<typeof userSchema>

import { z } from 'zod'

/**
 * List-users query DTO. Supports cursor pagination, role filter,
 * active filter, and free-text search.
 */
export const ListUsersQueryDtoSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['INSTITUTION_ADMIN', 'TEACHER', 'STUDENT']).optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().trim().min(1).max(100).optional(),
})

export type ListUsersQueryDto = z.infer<typeof ListUsersQueryDtoSchema>

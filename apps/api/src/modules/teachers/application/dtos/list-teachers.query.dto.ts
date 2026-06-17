import { z } from 'zod'

/**
 * List-teachers query DTO. Supports cursor pagination, active
 * filter, and free-text search.
 */
export const ListTeachersQueryDtoSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().trim().min(1).max(100).optional(),
})

export type ListTeachersQueryDto = z.infer<typeof ListTeachersQueryDtoSchema>

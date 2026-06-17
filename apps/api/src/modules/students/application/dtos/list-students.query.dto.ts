import { z } from 'zod'

/**
 * List-students query DTO. Supports cursor pagination, active
 * filter, free-text search, and career filter (REQ-STUDENT-001).
 */
export const ListStudentsQueryDtoSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().trim().min(1).max(100).optional(),
  career: z.string().trim().min(1).max(100).optional(),
})

export type ListStudentsQueryDto = z.infer<typeof ListStudentsQueryDtoSchema>

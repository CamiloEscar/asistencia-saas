import { z } from 'zod'

/** List-subjects query DTO. Supports cursor pagination and free-text search. */
export const ListSubjectsQueryDtoSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
})

export type ListSubjectsQueryDto = z.infer<typeof ListSubjectsQueryDtoSchema>

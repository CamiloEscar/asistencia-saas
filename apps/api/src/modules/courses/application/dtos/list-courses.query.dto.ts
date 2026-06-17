import { z } from 'zod'

/** List-courses query DTO. Supports cursor pagination, filters, free-text search. */
export const ListCoursesQueryDtoSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  subjectId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  semester: z.string().trim().min(1).max(20).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export type ListCoursesQueryDto = z.infer<typeof ListCoursesQueryDtoSchema>

import { z } from 'zod'

/** Teacher = user with role=TEACHER. The list endpoint wraps /api/teachers. */
export const listTeachersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
})
export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>

export const teacherSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  isActive: z.boolean().default(true),
  courseCount: z.number().int().default(0),
})
export type Teacher = z.infer<typeof teacherSchema>

import { z } from 'zod'

/** Body for `POST /api/courses/:id/enroll` and `/unenroll`. */
export const EnrollStudentsDtoSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(500),
})

export type EnrollStudentsDto = z.infer<typeof EnrollStudentsDtoSchema>

export const AssignTeachersDtoSchema = z.object({
  teacherIds: z.array(z.string().uuid()).min(1).max(50),
})

export type AssignTeachersDto = z.infer<typeof AssignTeachersDtoSchema>

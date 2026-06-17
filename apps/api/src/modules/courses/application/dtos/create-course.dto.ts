import { z } from 'zod'

/**
 * Schedule schema, reused by create + update DTOs. Mirrors the
 * domain `ScheduleVO` (see `value-objects/schedule.vo.ts`).
 */
const WeeklySlotSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be HH:mm'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be HH:mm'),
  })
  .refine(
    (s) => {
      const [shStr, smStr] = s.startTime.split(':')
      const [ehStr, emStr] = s.endTime.split(':')
      const sh = Number(shStr)
      const sm = Number(smStr)
      const eh = Number(ehStr)
      const em = Number(emStr)
      return eh * 60 + em > sh * 60 + sm
    },
    { message: 'endTime must be after startTime', path: ['endTime'] },
  )

const ScheduleSchema = z
  .object({
    weekly: z.array(WeeklySlotSchema).min(1),
  })
  .strict()

export { ScheduleSchema, WeeklySlotSchema }

/**
 * Create-course DTO. The schedule is validated against the same
 * shape as the domain VO. The `initialStudentIds` / `teacherIds`
 * arrays are optional — when provided, the use case auto-assigns
 * and enrolls in the same transaction.
 */
export const CreateCourseDtoSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Code must be alphanumeric with optional hyphens')
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  semester: z.string().trim().min(1).max(20),
  subjectId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  schedule: ScheduleSchema,
  defaultSessionDurationMin: z.coerce.number().int().min(15).max(480).optional(),
  teacherIds: z.array(z.string().uuid()).optional(),
  initialStudentIds: z.array(z.string().uuid()).optional(),
})

export type CreateCourseDto = z.infer<typeof CreateCourseDtoSchema>

export const CreateCourseResponseSchema = z.object({
  course: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    semester: z.string(),
    subjectId: z.string().uuid(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    schedule: ScheduleSchema,
    defaultSessionDurationMin: z.number(),
  }),
  assignedTeacherIds: z.array(z.string().uuid()),
  enrolledStudentIds: z.array(z.string().uuid()),
})

export type CreateCourseResponse = z.infer<typeof CreateCourseResponseSchema>

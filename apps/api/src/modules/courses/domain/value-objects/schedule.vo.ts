import { z } from 'zod'

/**
 * Schedule value object. Validates a course's recurring weekly
 * schedule (per spec REQ-COURSE-006):
 *   - Array of `WeeklySlot`s
 *   - Each slot: `dayOfWeek` (0-6, Sunday=0), `startTime` and
 *     `endTime` in `HH:mm` 24-hour format
 *   - `endTime` MUST be strictly after `startTime`
 *
 * The schedule is stored as JSONB on the `Course` row. The
 * generator (Phase 10.5 of the spec) explodes this into discrete
 * `ClassSession` rows.
 */
export const WeeklySlotSchema = z
  .object({
    dayOfWeek: z
      .number()
      .int()
      .min(0, 'Day must be 0-6 (Sunday-Saturday)')
      .max(6, 'Day must be 0-6 (Sunday-Saturday)'),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be HH:mm (24-hour)'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be HH:mm (24-hour)'),
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

export const ScheduleSchema = z
  .object({
    weekly: z.array(WeeklySlotSchema).min(1, 'Schedule must have at least one weekly slot'),
  })
  .strict()

export type WeeklySlot = z.infer<typeof WeeklySlotSchema>
export type Schedule = z.infer<typeof ScheduleSchema>

/**
 * Schedule VO wrapper for domain use. Construct via `Schedule.create`.
 * Provides a `toJson()` method for the DB JSONB column.
 */
export class ScheduleVO {
  private constructor(public readonly value: Schedule) {}

  static create(raw: unknown): ScheduleVO {
    return new ScheduleVO(ScheduleSchema.parse(raw))
  }

  static tryCreate(raw: unknown): ScheduleVO | undefined {
    const r = ScheduleSchema.safeParse(raw)
    return r.success ? new ScheduleVO(r.data) : undefined
  }

  toJson(): Schedule {
    return this.value
  }
}

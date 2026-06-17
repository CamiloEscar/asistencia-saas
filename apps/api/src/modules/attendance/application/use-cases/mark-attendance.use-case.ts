import { DateTime } from 'luxon'
import { ForbiddenException, BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { getTenantContext } from '../../../../shared/tenant/tenant.context'
import {
  ATTENDANCE_REPOSITORY,
  type IAttendanceRepository,
} from '../../domain/repositories/attendance.repository.interface'
import {
  CLASS_SESSION_REPOSITORY,
  type IClassSessionRepository,
} from '../../domain/repositories/class-session.repository.interface'
import type { MarkAttendanceDto } from '../dtos/mark-attendance.dto'

/**
 * MarkAttendanceUseCase — bulk mark attendance for a (course, date)
 * pair. The core "docente registra asistencia" flow. Per spec
 * REQ-ATT-001..007:
 *
 *   1. Validate the caller is the assigned teacher OR an
 *      INSTITUTION_ADMIN.
 *   2. Same-day rule for teachers: the requested date must equal
 *      "today" in the institution's timezone.
 *   3. Validate every studentId is enrolled in the course.
 *   4. Get-or-create the ClassSession for (course, date).
 *   5. Bulk upsert the attendance records (transactional).
 *   6. Mark the session COMPLETED.
 *   7. Return counts.
 *
 * Performance: typical 60-student class is one transaction; well
 * under 50ms server-side, <2s end-to-end (per design SC-1).
 */
@Injectable()
export class MarkAttendanceUseCase {
  private readonly logger = new Logger(MarkAttendanceUseCase.name)

  constructor(
    @Inject(ATTENDANCE_REPOSITORY)
    private readonly attendance: IAttendanceRepository,
    @Inject(CLASS_SESSION_REPOSITORY)
    private readonly classSessions: IClassSessionRepository,
  ) {}

  async execute(
    input: MarkAttendanceDto,
    ctx: { institutionId: string; actorUserId: string; actorRole: string },
  ): Promise<{
    sessionId: string
    created: number
    updated: number
    presentCount: number
    absentCount: number
    lateCount: number
    justifiedCount: number
  }> {
    // 1. Resolve institution TZ from AsyncLocalStorage.
    const tenantCtx = getTenantContext()
    const timezone = tenantCtx?.timezone ?? 'America/Argentina/Buenos_Aires'

    // 2. Parse the input date as a calendar day in the institution TZ.
    const requestedDay = DateTime.fromISO(input.date, { zone: timezone })
    if (!requestedDay.isValid) {
      throw new BadRequestException({
        message: `Invalid date: ${input.date}`,
        error: 'Bad Request',
        field: 'date',
      })
    }
    const today = DateTime.now().setZone(timezone).startOf('day')
    const requestStart = requestedDay.startOf('day')

    // 3. Same-day rule (REQ-ATT-002) and "no future dates" sanity check.
    if (requestStart > today) {
      throw new BadRequestException({
        message: 'Cannot mark attendance for a future date',
        error: 'Bad Request',
        field: 'date',
      })
    }
    if (ctx.actorRole === 'TEACHER' && !requestStart.equals(today)) {
      throw new ForbiddenException({
        message: 'Attendance can only be marked for today (same-day rule)',
        error: 'Forbidden',
        field: 'date',
      })
    }

    // 4. If teacher, validate they're assigned to this course.
    if (ctx.actorRole === 'TEACHER') {
      const assigned = await this.classSessions.isTeacherAssignedToCourse(
        ctx.institutionId,
        ctx.actorUserId,
        input.courseId,
      )
      if (!assigned) {
        throw new ForbiddenException({
          message: 'Teacher is not assigned to this course',
          error: 'Forbidden',
        })
      }
    } else if (ctx.actorRole !== 'INSTITUTION_ADMIN' && ctx.actorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        message: 'Only teachers and institution admins can mark attendance',
        error: 'Forbidden',
      })
    }

    // 5. Validate every student is enrolled (REQ-ATT-001-04 — full
    //    rollback if any are missing).
    const studentIds = input.records.map((r) => r.studentId)
    await this.attendance.validateStudentsEnrolledInCourse(input.courseId, studentIds)

    // 6. Get-or-create the ClassSession for (course, date) in the
    //    institution's TZ. Day start is 00:00 local.
    const dayStartLocal = requestStart.toJSDate()
    const duration =
      input.sessionDurationMin ??
      (await this.classSessions.getCourseDefaultDuration(ctx.institutionId, input.courseId)) ??
      80
    const session = await this.classSessions.getOrCreateForCourseAndDate({
      institutionId: ctx.institutionId,
      courseId: input.courseId,
      scheduledAt: dayStartLocal,
      durationMin: duration,
      createdBy: ctx.actorUserId,
      topic: input.sessionNotes ?? null,
    })

    // 7. Bulk upsert (transactional in the repo).
    const records = input.records.map((r) => ({
      studentId: r.studentId,
      status: r.status ?? 'PRESENT',
      justificationText: r.justificationText ?? null,
    }))
    const result = await this.attendance.bulkCreateOrUpdate({
      sessionId: session.id,
      institutionId: ctx.institutionId,
      recordedBy: ctx.actorUserId,
      records,
    })

    // 8. Mark session COMPLETED (after a successful bulk mark the
    //    session has been "used"; see task description's
    //    canBeReopened = false design choice).
    await this.classSessions.markCompleted(session.id)

    // 9. Per-status counts for the response.
    const counts = { present: 0, absent: 0, late: 0, justified: 0 }
    for (const r of records) {
      counts[r.status.toLowerCase() as 'present' | 'absent' | 'late' | 'justified'] += 1
    }

    this.logger.log(
      `markAttendance: course=${input.courseId} date=${requestStart.toISODate()} ` +
        `created=${result.created} updated=${result.updated} actor=${ctx.actorUserId}`,
    )

    return {
      sessionId: session.id,
      created: result.created,
      updated: result.updated,
      presentCount: counts.present,
      absentCount: counts.absent,
      lateCount: counts.late,
      justifiedCount: counts.justified,
    }
  }
}

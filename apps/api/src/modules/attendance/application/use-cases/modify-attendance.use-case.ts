import { DateTime } from 'luxon'
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  ATTENDANCE_REPOSITORY,
  type IAttendanceRepository,
  type UpdateAttendanceInput,
} from '../../domain/repositories/attendance.repository.interface'
import {
  CLASS_SESSION_REPOSITORY,
  type IClassSessionRepository,
} from '../../domain/repositories/class-session.repository.interface'
import type { ModifyAttendanceDto } from '../dtos/modify-attendance.dto'

/**
 * ModifyAttendanceUseCase — modify a single attendance record.
 * Per spec REQ-ATT-002:
 *
 *   1. Load the attendance, validate it exists (404 if not).
 *   2. If the caller is a TEACHER:
 *        a. Enforce the SAME-DAY rule: the session's
 *           `scheduledAt` (in the institution's TZ) must equal
 *           "today" in the same TZ.
 *        b. Validate the teacher is assigned to the session's
 *           course.
 *      If the caller is INSTITUTION_ADMIN / SUPER_ADMIN: any date
 *      is allowed.
 *   3. Update status + justificationText + evidenceUrl (only the
 *      fields the caller sent).
 *   4. The audit log entry is written by the AuditInterceptor at
 *      the controller layer (`@Audit({ action: 'ATTENDANCE_MODIFIED' })`).
 */
@Injectable()
export class ModifyAttendanceUseCase {
  private readonly logger = new Logger(ModifyAttendanceUseCase.name)

  constructor(
    @Inject(ATTENDANCE_REPOSITORY)
    private readonly attendance: IAttendanceRepository,
    @Inject(CLASS_SESSION_REPOSITORY)
    private readonly classSessions: IClassSessionRepository,
  ) {}

  async execute(
    id: string,
    input: ModifyAttendanceDto,
    ctx: { actorUserId: string; actorRole: string },
  ) {
    // 1. Load the attendance.
    const record = await this.attendance.findById(id)
    if (!record) {
      throw new NotFoundException({
        message: 'Attendance record not found',
        error: 'Not Found',
      })
    }

    // 2. Load the session to get its date for the same-day check.
    const session = await this.classSessions.findById(record.sessionId)
    if (!session) {
      // Data integrity: attendance points to a missing session.
      // Treat as 404 to avoid leaking schema internals.
      throw new NotFoundException({
        message: 'Attendance record not found',
        error: 'Not Found',
      })
    }

    // 3. Authorization: same-day rule for teachers, plus course-assignment check.
    if (ctx.actorRole === 'TEACHER') {
      const timezone = 'America/Argentina/Buenos_Aires'
      const sessionDay = DateTime.fromJSDate(session.scheduledAt).setZone(timezone).startOf('day')
      const today = DateTime.now().setZone(timezone).startOf('day')
      if (!sessionDay.equals(today)) {
        throw new ForbiddenException({
          message: 'Attendance can only be modified on the same day',
          error: 'Forbidden',
        })
      }
      const assigned = await this.classSessions.isTeacherAssignedToCourse(
        ctx.actorUserId,
        session.courseId,
      )
      if (!assigned) {
        throw new ForbiddenException({
          message: 'Teacher is not assigned to this course',
          error: 'Forbidden',
        })
      }
    } else if (ctx.actorRole !== 'ADMIN') {
      throw new ForbiddenException({
        message: 'Only teachers and admins can modify attendance',
        error: 'Forbidden',
      })
    }

    // 4. Apply the update — only the fields the caller sent.
    const updateInput: UpdateAttendanceInput = {}
    if (input.status !== undefined) updateInput.status = input.status
    if (input.justificationText !== undefined) {
      updateInput.justificationText = input.justificationText
    }
    if (input.evidenceUrl !== undefined) {
      updateInput.evidenceUrl = input.evidenceUrl
    }
    const updated = await this.attendance.updateById(
      id,
      updateInput,
      ctx.actorUserId,
    )

    this.logger.log(
      `modifyAttendance: id=${id} actor=${ctx.actorUserId} fields=${Object.keys(updateInput).join(',')}`,
    )

    return updated
  }
}

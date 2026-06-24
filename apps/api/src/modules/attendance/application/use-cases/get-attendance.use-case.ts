import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  ATTENDANCE_REPOSITORY,
  type IAttendanceRepository,
} from '../../domain/repositories/attendance.repository.interface'
import {
  CLASS_SESSION_REPOSITORY,
  type IClassSessionRepository,
} from '../../domain/repositories/class-session.repository.interface'

/**
 * GetAttendanceUseCase — fetch a single attendance record,
 * enforcing role-based visibility (TEACHER sees only their own
 * courses' records; STUDENT sees only their own).
 *
 * The role check is done here rather than in the controller so
 * the authorization logic stays next to the persistence layer
 * (it's a domain concern, not a presentation concern).
 */
@Injectable()
export class GetAttendanceUseCase {
  constructor(
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendance: IAttendanceRepository,
    @Inject(CLASS_SESSION_REPOSITORY)
    private readonly classSessions: IClassSessionRepository,
  ) {}

  async execute(
    id: string,
    ctx: { actorUserId: string; actorRole: string },
  ) {
    const record = await this.attendance.findById(id)
    if (!record) {
      throw new NotFoundException({
        message: 'Attendance record not found',
        error: 'Not Found',
      })
    }

    if (ctx.actorRole === 'TEACHER') {
      const session = await this.classSessions.findById(record.sessionId)
      if (!session) {
        // Should not happen; the FK guarantees the session exists.
        throw new NotFoundException({
          message: 'Attendance record not found',
          error: 'Not Found',
        })
      }
      const assigned = await this.classSessions.isTeacherAssignedToCourse(
        ctx.actorUserId,
        session.courseId,
      )
      if (!assigned) {
        throw new ForbiddenException({
          message: 'You can only view attendance for courses you teach',
          error: 'Forbidden',
        })
      }
    } else if (ctx.actorRole === 'STUDENT') {
      // STUDENTs can only view their own attendance.
      if (record.studentId !== ctx.actorUserId) {
        throw new NotFoundException({
          message: 'Attendance record not found',
          error: 'Not Found',
        })
      }
    }
    // ADMIN / SUPER_ADMIN: no extra check.

    return record
  }
}

import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import {
  ATTENDANCE_REPOSITORY,
  type AttendanceSummary,
  type IAttendanceRepository,
  type StudentAttendanceSummary,
} from '../../domain/repositories/attendance.repository.interface'
import type { AttendanceSummaryQueryDto } from '../dtos/attendance-summary.query.dto'

/**
 * AttendanceSummaryUseCase — aggregates for course, student, or
 * teacher. Per spec REQ-ATT-004 (course), REQ-ATT-005 (student),
 * and the design's "summary by teacher" (admin dashboard).
 *
 * The query DTO carries exactly one of `courseId` or `studentId`
 * (XOR per the spec's edge case). The `forSelf` path lets a
 * STUDENT request their own summary without passing `studentId`.
 */
@Injectable()
export class AttendanceSummaryUseCase {
  constructor(@Inject(ATTENDANCE_REPOSITORY) private readonly attendance: IAttendanceRepository) {}

  async executeCourse(
    courseId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<AttendanceSummary> {
    return this.attendance.summaryByCourse(courseId, dateRange)
  }

  async executeStudent(
    studentId: string,
    courseId?: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<StudentAttendanceSummary> {
    return this.attendance.summaryByStudent(studentId, courseId, dateRange)
  }

  async executeTeacher(
    teacherId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<AttendanceSummary> {
    return this.attendance.summaryByTeacher(teacherId, dateRange)
  }

  /**
   * Resolve the appropriate summary call from the DTO. The DTO
   * disambiguates by which field is set. Enforces that STUDENT
   * can only see their own summary (or an explicit `studentId`
   * that matches their own id).
   */
  async executeFromQuery(
    query: AttendanceSummaryQueryDto,
    caller: { role: string; userId: string },
  ): Promise<AttendanceSummary | StudentAttendanceSummary> {
    const role = caller.role
    const userId = caller.userId

    const dateRange =
      query.dateFrom || query.dateTo
        ? {
            ...(query.dateFrom ? { from: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { to: new Date(query.dateTo) } : {}),
          }
        : undefined

    if (query.courseId) {
      return this.executeCourse(query.courseId, dateRange)
    }
    if (query.studentId) {
      // STUDENT can only request their own summary.
      if (role === 'STUDENT' && query.studentId !== userId) {
        throw new ForbiddenException({
          message: 'Students can only see their own summary',
          error: 'Forbidden',
        })
      }
      return this.executeStudent(query.studentId, query.studentCourseId, dateRange)
    }
    if (query.teacherId) {
      return this.executeTeacher(query.teacherId, dateRange)
    }

    // Default: empty summary (no specific entity).
    return {
      present: 0,
      absent: 0,
      late: 0,
      justified: 0,
      total: 0,
      percentages: { present: 0, absent: 0, late: 0, justified: 0 },
    }
  }
}

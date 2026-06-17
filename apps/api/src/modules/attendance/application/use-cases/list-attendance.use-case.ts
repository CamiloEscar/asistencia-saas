import { Inject, Injectable } from '@nestjs/common'
import { getTenantContext } from '../../../../shared/tenant/tenant.context'
import {
  ATTENDANCE_REPOSITORY,
  type IAttendanceRepository,
  type ListAttendanceInput,
  type ListAttendanceResult,
} from '../../domain/repositories/attendance.repository.interface'
import type { ListAttendanceQueryDto } from '../dtos/list-attendance.query.dto'

/**
 * ListAttendanceUseCase — cursor-paginated list with role-based
 * filtering. Per spec REQ-ATT-003:
 *   - INSTITUTION_ADMIN / SUPER_ADMIN → all records in the institution
 *   - TEACHER → only records for sessions whose course is assigned to
 *     the teacher
 *   - STUDENT → only their own records
 *
 * The role-based filter is applied at the repository layer (it
 * translates the input into a Prisma `where` clause). This use case
 * is a thin orchestration layer that pulls the role from the
 * tenant context and delegates.
 */
@Injectable()
export class ListAttendanceUseCase {
  constructor(
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendance: IAttendanceRepository,
  ) {}

  async execute(
    query: ListAttendanceQueryDto,
    institutionId: string,
  ): Promise<ListAttendanceResult> {
    const ctx = getTenantContext()
    const role = ctx?.role
    const userId = ctx?.userId

    let forRole: 'ADMIN' | 'TEACHER' | 'STUDENT'
    if (role === 'TEACHER') forRole = 'TEACHER'
    else if (role === 'STUDENT') forRole = 'STUDENT'
    else forRole = 'ADMIN'

    const input: ListAttendanceInput = {
      cursor: query.cursor ?? null,
      limit: query.limit ?? 20,
      courseId: query.courseId ?? null,
      studentId: query.studentId ?? null,
      sessionId: query.sessionId ?? null,
      status: query.status ?? null,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : null,
      dateTo: query.dateTo ? new Date(query.dateTo) : null,
      forRole,
      ...(userId ? { forUserId: userId } : {}),
    }
    return this.attendance.listInInstitution(institutionId, input)
  }
}

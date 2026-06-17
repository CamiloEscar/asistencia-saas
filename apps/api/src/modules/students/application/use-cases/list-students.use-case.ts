import { Inject, Injectable } from '@nestjs/common'
import { getTenantContext } from '../../../../shared/tenant/tenant.context'
import {
  STUDENT_REPOSITORY,
  type IStudentRepository,
  type ListStudentsResult,
} from '../../domain/repositories/student.repository.interface'

/**
 * ListStudentsUseCase — paginated list of students in the caller's
 * institution. Per spec REQ-STUDENT-001:
 *   - INSTITUTION_ADMIN sees all students in the institution.
 *   - TEACHER sees only students enrolled in their courses
 *     (REQ-STUDENT-001-03).
 *   - SUPER_ADMIN sees all (uses the institutions flow, not this one).
 *
 * The role-based filter is applied by the repository:
 * `listInInstitution` for admin, `listForTeacher` for teacher.
 */
@Injectable()
export class ListStudentsUseCase {
  constructor(@Inject(STUDENT_REPOSITORY) private readonly students: IStudentRepository) {}

  async execute(
    institutionId: string,
    input: {
      cursor?: string | null
      limit?: number
      isActive?: boolean | null
      search?: string | null
      career?: string | null
    },
  ): Promise<ListStudentsResult> {
    const ctx = getTenantContext()
    const role = ctx?.role

    if (role === 'TEACHER' && ctx?.userId) {
      return this.students.listForTeacher(institutionId, ctx.userId, {
        cursor: input.cursor ?? null,
        limit: input.limit ?? 20,
        isActive: input.isActive ?? null,
        search: input.search ?? null,
        career: input.career ?? null,
      })
    }

    return this.students.listInInstitution(institutionId, {
      cursor: input.cursor ?? null,
      limit: input.limit ?? 20,
      isActive: input.isActive ?? null,
      search: input.search ?? null,
      career: input.career ?? null,
    })
  }
}

import { Inject, Injectable } from '@nestjs/common'
import {
  STUDENT_REPOSITORY,
  type IStudentRepository,
  type ListStudentsResult,
} from '../../domain/repositories/student.repository.interface'

/**
 * ListStudentsUseCase — paginated list of students.
 * Per spec REQ-STUDENT-001:
 *   - ADMIN sees all students.
 *   - TEACHER sees only students enrolled in their courses
 *     (REQ-STUDENT-001-03).
 *
 * The role-based filter is applied by the repository:
 * `list` for admin, `listForTeacher` for teacher.
 */
@Injectable()
export class ListStudentsUseCase {
  constructor(@Inject(STUDENT_REPOSITORY) private readonly students: IStudentRepository) {}

  async execute(
    input: {
      cursor?: string | null
      limit?: number
      isActive?: boolean | null
      search?: string | null
      career?: string | null
    },
    caller: { role: string; userId: string },
  ): Promise<ListStudentsResult> {
    if (caller.role === 'TEACHER') {
      return this.students.listForTeacher(caller.userId, {
        cursor: input.cursor ?? null,
        limit: input.limit ?? 20,
        isActive: input.isActive ?? null,
        search: input.search ?? null,
        career: input.career ?? null,
      })
    }

    return this.students.list({
      cursor: input.cursor ?? null,
      limit: input.limit ?? 20,
      isActive: input.isActive ?? null,
      search: input.search ?? null,
      career: input.career ?? null,
    })
  }
}

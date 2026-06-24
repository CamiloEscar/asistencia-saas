import { Inject, Injectable } from '@nestjs/common'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
  type ListCoursesResult,
} from '../../domain/repositories/course.repository.interface'

/**
 * ListCoursesUseCase — paginated list of courses. Per spec
 * REQ-COURSE-001:
 *   - ADMIN: all courses.
 *   - TEACHER: only courses they're assigned to.
 *   - STUDENT: only courses they're enrolled in.
 *
 * The role-based filter is read from the tenant context (populated
 * by JwtAuthGuard) and applied at the repository.
 */
@Injectable()
export class ListCoursesUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(input: {
    cursor?: string | null
    limit?: number
    subjectId?: string | null
    teacherId?: string | null
    studentId?: string | null
    semester?: string | null
    search?: string | null
    isActive?: boolean | null
    caller?: { role: string; userId: string }
  }): Promise<ListCoursesResult> {
    const role = input.caller?.role
    const userId = input.caller?.userId

    let forRole: 'ADMIN' | 'TEACHER' | 'STUDENT' | undefined
    if (role === 'TEACHER') forRole = 'TEACHER'
    else if (role === 'STUDENT') forRole = 'STUDENT'
    else forRole = 'ADMIN'

    return this.courses.list({
      cursor: input.cursor ?? null,
      limit: input.limit ?? 20,
      subjectId: input.subjectId ?? null,
      teacherId: input.teacherId ?? null,
      studentId: input.studentId ?? null,
      semester: input.semester ?? null,
      search: input.search ?? null,
      isActive: input.isActive ?? null,
      forRole,
      ...(userId ? { forUserId: userId } : {}),
    })
  }
}

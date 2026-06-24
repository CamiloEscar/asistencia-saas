import { Inject, Injectable } from '@nestjs/common'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
  type ListCoursesResult,
} from '../../domain/repositories/course.repository.interface'

/**
 * MyCoursesUseCase — returns the courses assigned to the calling
 * teacher (REQ-TEACHER-005, REQ-COURSE-010). The repository does
 * the role-based filter using `forRole: 'TEACHER'` + `forUserId`
 * (see `PrismaCourseRepository.list`).
 *
 * The teacher is identified from the JWT claims (populated by
 * JwtAuthGuard into the tenant context). No role check happens
 * here because the route is guarded by `@Roles('TEACHER')`.
 */
@Injectable()
export class MyCoursesUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(teacherUserId: string): Promise<ListCoursesResult> {
    return this.courses.list({
      forRole: 'TEACHER',
      forUserId: teacherUserId,
      isActive: true,
      limit: 100,
    })
  }
}

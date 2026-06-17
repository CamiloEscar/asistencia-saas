import { Inject, Injectable } from '@nestjs/common'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'

/**
 * UnenrollStudentUseCase — removes a student from a course.
 * Idempotent: no-op if not enrolled. Historical attendance
 * is preserved (REQ-COURSE-011-01).
 */
@Injectable()
export class UnenrollStudentUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(courseId: string, studentId: string): Promise<{ removed: boolean }> {
    const wasEnrolled = await this.courses.isStudentEnrolled(courseId, studentId)
    if (!wasEnrolled) {
      return { removed: false }
    }
    await this.courses.unenrollStudent(courseId, studentId)
    return { removed: true }
  }
}

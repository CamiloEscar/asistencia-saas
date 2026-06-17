import { ConflictException, Inject, Injectable } from '@nestjs/common'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'

/**
 * UnassignTeacherUseCase — removes a teacher from a course.
 * Protects the last teacher (REQ-COURSE-012-02).
 */
@Injectable()
export class UnassignTeacherUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(courseId: string, teacherId: string): Promise<{ removed: boolean }> {
    const total = await this.courses.countAssignedTeachers(courseId)
    if (total <= 1) {
      throw new ConflictException({
        message: 'Cannot remove the last teacher',
        error: 'Conflict',
      })
    }
    await this.courses.unassignTeacher(courseId, teacherId)
    return { removed: true }
  }
}

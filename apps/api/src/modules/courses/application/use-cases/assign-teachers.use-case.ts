import { Inject, Injectable } from '@nestjs/common'
import {
  COURSE_REPOSITORY,
  type AssignedTeacher,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'

/**
 * AssignTeachersUseCase — assigns a list of teachers to a course.
 * Idempotent (REQ-COURSE-007-02): re-assigning the same teacher
 * is a no-op. Each teacherId is validated to exist.
 */
@Injectable()
export class AssignTeachersUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(
    courseId: string,
    teacherIds: string[],
  ): Promise<{ added: string[]; teachers: AssignedTeacher[] }> {
    for (const teacherId of teacherIds) {
      await this.courses.validateTeacherExists(teacherId)
      await this.courses.assignTeacher(courseId, teacherId)
    }
    const teachers = await this.courses.listAssignedTeachers(courseId)
    return { added: teacherIds, teachers }
  }
}

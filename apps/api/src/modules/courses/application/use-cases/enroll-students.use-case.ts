import { Inject, Injectable } from '@nestjs/common'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'

/**
 * EnrollStudentsUseCase — enrolls a list of students in a course.
 * Idempotent (REQ-COURSE-008-02). Each studentId is validated to exist.
 */
@Injectable()
export class EnrollStudentsUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(
    courseId: string,
    studentIds: string[],
  ): Promise<{ enrolled: string[]; total: number }> {
    for (const studentId of studentIds) {
      await this.courses.validateStudentExists(studentId)
      await this.courses.enrollStudent(courseId, studentId)
    }
    const total = (await this.courses.listEnrolledStudents(courseId)).length
    return { enrolled: studentIds, total }
  }
}

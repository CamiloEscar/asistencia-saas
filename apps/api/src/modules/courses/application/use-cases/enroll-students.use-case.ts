import { Inject, Injectable } from '@nestjs/common'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'

/**
 * EnrollStudentsUseCase — enrolls a list of students in a course.
 * Idempotent (REQ-COURSE-008-02). Cross-tenant: each studentId is
 * validated against the caller's institution by the repository.
 */
@Injectable()
export class EnrollStudentsUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(
    institutionId: string,
    courseId: string,
    studentIds: string[],
  ): Promise<{ enrolled: string[]; total: number }> {
    for (const studentId of studentIds) {
      await this.courses.validateStudentInInstitution(institutionId, studentId)
      await this.courses.enrollStudent(courseId, studentId)
    }
    const total = (await this.courses.listEnrolledStudents(courseId)).length
    return { enrolled: studentIds, total }
  }
}

import { Inject, Injectable } from '@nestjs/common'
import {
  COURSE_REPOSITORY,
  type EnrolledStudent,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'

/**
 * ListEnrolledStudentsUseCase — returns the students enrolled in
 * a course, sorted by legajo ASC. Used by the teacher to take
 * attendance (REQ-COURSE-009).
 */
@Injectable()
export class ListEnrolledStudentsUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  execute(courseId: string): Promise<EnrolledStudent[]> {
    return this.courses.listEnrolledStudents(courseId)
  }
}

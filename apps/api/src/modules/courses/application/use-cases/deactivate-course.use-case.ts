import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Course } from '../../domain/entities/course.entity'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'

/**
 * DeactivateCourseUseCase — soft delete (sets deletedAt = now).
 * Historical attendance is preserved (REQ-COURSE-005-01). For
 * MVP, we do NOT cascade-cancel future sessions (that's a
 * follow-up; the spec says it should happen, but the
 * `ClassSession` module lands in Phase 11).
 */
@Injectable()
export class DeactivateCourseUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(institutionId: string, id: string): Promise<Course> {
    const target = await this.courses.findByIdInInstitution(institutionId, id)
    if (!target) {
      throw new NotFoundException({ message: 'Course not found', error: 'Not Found' })
    }
    return this.courses.setDeletedInInstitution(institutionId, id)
  }
}

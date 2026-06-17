import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Course } from '../../domain/entities/course.entity'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'

/**
 * GetCourseUseCase — fetch a single course by id, scoped to the
 * caller's institution. Returns 404 for cross-tenant lookups.
 */
@Injectable()
export class GetCourseUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(institutionId: string, id: string): Promise<Course> {
    const found = await this.courses.findByIdInInstitution(institutionId, id)
    if (!found) {
      throw new NotFoundException({ message: 'Course not found', error: 'Not Found' })
    }
    return found
  }
}

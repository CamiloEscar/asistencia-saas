import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Course } from '../../domain/entities/course.entity'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'

/**
 * GetCourseUseCase — fetch a single course by id. Returns 404 if
 * not found.
 */
@Injectable()
export class GetCourseUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(id: string): Promise<Course> {
    const found = await this.courses.findById(id)
    if (!found) {
      throw new NotFoundException({ message: 'Course not found', error: 'Not Found' })
    }
    return found
  }
}

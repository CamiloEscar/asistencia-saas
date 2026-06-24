import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Course } from '../../domain/entities/course.entity'
import { ScheduleVO } from '../../domain/value-objects/schedule.vo'
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'
import type { UpdateCourseDto } from '../dtos/update-course.dto'

/**
 * UpdateCourseUseCase — partial update for a course. `code` is
 * immutable (REQ-COURSE-004-02). The schedule is re-validated
 * against the ScheduleVO when provided.
 */
@Injectable()
export class UpdateCourseUseCase {
  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(id: string, input: UpdateCourseDto): Promise<Course> {
    const target = await this.courses.findById(id)
    if (!target) {
      throw new NotFoundException({ message: 'Course not found', error: 'Not Found' })
    }

    // Re-validate schedule when changing.
    if (input.schedule !== undefined) {
      ScheduleVO.create(input.schedule)
    }

    return this.courses.update(id, {
      name: input.name as string | undefined,
      description: input.description as string | null | undefined,
      startDate: input.startDate ? new Date(input.startDate as string | number | Date) : undefined,
      endDate: input.endDate ? new Date(input.endDate as string | number | Date) : undefined,
      schedule: input.schedule as unknown,
      ...(input.defaultSessionDurationMin !== undefined
        ? { defaultSessionDurationMin: input.defaultSessionDurationMin as number }
        : {}),
    })
  }
}

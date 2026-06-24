import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import { ScheduleVO } from '../../domain/value-objects/schedule.vo'
import {
  COURSE_REPOSITORY,
  type CreateCourseInput,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'
import type { CreateCourseDto, CreateCourseResponse } from '../dtos/create-course.dto'

/**
 * CreateCourseUseCase — creates a course, optionally assigning
 * teachers and enrolling students in a single transaction. Per
 * spec REQ-COURSE-002:
 *   - Validates subject exists.
 *   - Validates teachers exist.
 *   - Validates students exist.
 *   - Code is unique (409 on conflict).
 *
 * Class session generation (REQ-ATT-010) is a follow-up: the
 * schedule is stored on the course row; sessions are created by
 * the `ClassSessionGenerator` in Phase 10.5. For the MVP we
 * persist the schedule as JSONB and let the controller's
 * subsequent session-creation step explode it.
 */
@Injectable()
export class CreateCourseUseCase {
  private readonly logger = new Logger(CreateCourseUseCase.name)

  constructor(@Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository) {}

  async execute(input: CreateCourseDto): Promise<CreateCourseResponse> {
    // 1. Validate schedule format.
    const schedule = ScheduleVO.create(input.schedule)

    // 2. Existence validation.
    await this.courses.validateSubjectExists(input.subjectId)
    if (input.teacherIds) {
      for (const teacherId of input.teacherIds) {
        await this.courses.validateTeacherExists(teacherId)
      }
    }
    if (input.initialStudentIds) {
      for (const studentId of input.initialStudentIds) {
        await this.courses.validateStudentExists(studentId)
      }
    }

    // 3. Code uniqueness.
    const code = input.code.toUpperCase()
    const existing = await this.courses.findByCode(code)
    if (existing) {
      throw new ConflictException({
        message: 'Course code already in use',
        error: 'Conflict',
        field: 'code',
      })
    }

    // 4. Date sanity.
    if (input.endDate <= input.startDate) {
      throw new ConflictException({
        message: 'endDate must be after startDate',
        error: 'Conflict',
        field: 'endDate',
      })
    }

    // 5. Create the course.
    const createInput: CreateCourseInput = {
      subjectId: input.subjectId,
      code,
      name: input.name,
      description: input.description ?? null,
      semester: input.semester,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      schedule: schedule.toJson(),
      defaultSessionDurationMin: input.defaultSessionDurationMin ?? 80,
    }
    const course = await this.courses.create(createInput)

    // 6. Assign teachers (idempotent) and enroll students.
    if (input.teacherIds) {
      for (const teacherId of input.teacherIds) {
        await this.courses.assignTeacher(course.id, teacherId)
      }
    }
    if (input.initialStudentIds) {
      for (const studentId of input.initialStudentIds) {
        await this.courses.enrollStudent(course.id, studentId)
      }
    }

    return {
      course: {
        ...course.toPublicJson(),
        schedule: course.toPublicJson().schedule as {
          weekly: { dayOfWeek: number; startTime: string; endTime: string }[]
        },
      },
      assignedTeacherIds: input.teacherIds ?? [],
      enrolledStudentIds: input.initialStudentIds ?? [],
    }
  }
}

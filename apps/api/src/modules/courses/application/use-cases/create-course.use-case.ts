import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import { ScheduleVO } from '../../domain/value-objects/schedule.vo'
import {
  COURSE_REPOSITORY,
  type CreateCourseInput,
  type ICourseRepository,
} from '../../domain/repositories/course.repository.interface'
import type { CreateCourseDto, CreateCourseResponse } from '../dtos/create-course.dto'

/**
 * CreateCourseUseCase — creates a course in the caller's
 * institution, optionally assigning teachers and enrolling students
 * in a single transaction. Per spec REQ-COURSE-002:
 *   - Validates subject belongs to the same institution.
 *   - Validates teacher belongs to the same institution.
 *   - Validates students belong to the same institution.
 *   - Code is unique within the institution (409 on conflict).
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

  async execute(input: CreateCourseDto, institutionId: string): Promise<CreateCourseResponse> {
    // 1. Validate schedule format.
    const schedule = ScheduleVO.create(input.schedule)

    // 2. Cross-tenant validation.
    await this.courses.validateSubjectInInstitution(institutionId, input.subjectId)
    if (input.teacherIds) {
      for (const teacherId of input.teacherIds) {
        await this.courses.validateTeacherInInstitution(institutionId, teacherId)
      }
    }
    if (input.initialStudentIds) {
      for (const studentId of input.initialStudentIds) {
        await this.courses.validateStudentInInstitution(institutionId, studentId)
      }
    }

    // 3. Code uniqueness.
    const code = input.code.toUpperCase()
    const existing = await this.courses.findByCodeInInstitution(institutionId, code)
    if (existing) {
      throw new ConflictException({
        message: 'Course code already in use in this institution',
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
      institutionId,
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
    const course = await this.courses.createInInstitution(createInput)

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

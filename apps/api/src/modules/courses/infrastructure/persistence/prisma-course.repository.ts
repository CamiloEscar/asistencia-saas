import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../shared/prisma/prisma.service'
import { Course, type CourseProps } from '../../domain/entities/course.entity'
import type {
  AssignedTeacher,
  CreateCourseInput,
  EnrolledStudent,
  ICourseRepository,
  ListCoursesInput,
  ListCoursesResult,
  UpdateCourseInput,
} from '../../domain/repositories/course.repository.interface'

/**
 * Prisma implementation of `ICourseRepository`. Manages the m:n
 * relationships:
 *   - `Enrollment` (course ↔ student)
 *   - `CourseTeacher` (course ↔ teacher)
 */
@Injectable()
export class PrismaCourseRepository implements ICourseRepository {
  private readonly logger = new Logger(PrismaCourseRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  // ─── Reads ────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Course | null> {
    const row = await this.prisma.course.findFirst({ where: { id } })
    return row ? this.toEntity(row) : null
  }

  async findByCode(code: string): Promise<Course | null> {
    const row = await this.prisma.course.findFirst({
      where: { code: code.toUpperCase() },
    })
    return row ? this.toEntity(row) : null
  }

  async list(input: ListCoursesInput): Promise<ListCoursesResult> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
    const where: Record<string, unknown> = {}
    if (input.subjectId) where.subjectId = input.subjectId
    if (input.semester) where.semester = input.semester
    if (input.isActive !== null && input.isActive !== undefined) {
      if (input.isActive) {
        where.deletedAt = null
      } else {
        where.deletedAt = { not: null }
      }
    }
    if (input.search) {
      const q = input.search.trim()
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    }

    // Role-based filtering: TEACHER sees only assigned courses,
    // STUDENT sees only enrolled courses. ADMIN sees all.
    if (input.forRole === 'TEACHER' && input.forUserId) {
      const assignments = await this.prisma.courseTeacher.findMany({
        where: { teacherId: input.forUserId },
        select: { courseId: true },
      })
      const courseIds = assignments.map((a: { courseId: string }) => a.courseId)
      if (courseIds.length === 0) {
        return { data: [], nextCursor: null, hasMore: false }
      }
      where.id = { in: courseIds }
    } else if (input.forRole === 'STUDENT' && input.forUserId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { studentId: input.forUserId },
        select: { courseId: true },
      })
      const courseIds = enrollments.map((e: { courseId: string }) => e.courseId)
      if (courseIds.length === 0) {
        return { data: [], nextCursor: null, hasMore: false }
      }
      where.id = { in: courseIds }
    }

    // Additional explicit filters can narrow the above set.
    if (input.teacherId) {
      const assignments = await this.prisma.courseTeacher.findMany({
        where: { teacherId: input.teacherId },
        select: { courseId: true },
      })
      const courseIds = new Set(assignments.map((a: { courseId: string }) => a.courseId))
      if (where.id && typeof where.id === 'object' && 'in' in where.id) {
        // Intersect with the existing filter.
        const existing = (where.id as { in: string[] }).in
        where.id = { in: existing.filter((id: string) => courseIds.has(id)) }
      } else {
        where.id = { in: Array.from(courseIds) }
      }
    }
    if (input.studentId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { studentId: input.studentId },
        select: { courseId: true },
      })
      const courseIds = new Set(enrollments.map((e: { courseId: string }) => e.courseId))
      if (where.id && typeof where.id === 'object' && 'in' in where.id) {
        const existing = (where.id as { in: string[] }).in
        where.id = { in: existing.filter((id: string) => courseIds.has(id)) }
      } else {
        where.id = { in: Array.from(courseIds) }
      }
    }

    const rows = await this.prisma.course.findMany({
      where,
      orderBy: { code: 'asc' },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit
    const slice = hasMore ? rows.slice(0, limit) : rows
    const lastId = slice.length > 0 ? slice[slice.length - 1]!.id : null

    return {
      data: slice.map((r: Record<string, unknown>) => this.toEntity(r)),
      nextCursor: hasMore && lastId ? lastId : null,
      hasMore,
    }
  }

  // ─── Writes ───────────────────────────────────────────────────────────

  async create(input: CreateCourseInput): Promise<Course> {
    const row = await this.prisma.course.create({
      data: {
        subjectId: input.subjectId,
        code: input.code.toUpperCase(),
        name: input.name,
        description: input.description ?? null,
        semester: input.semester,
        startDate: input.startDate,
        endDate: input.endDate,
        schedule: input.schedule as never,
        defaultSessionDurationMin: input.defaultSessionDurationMin ?? 80,
      },
    })
    return this.toEntity(row)
  }

  async update(id: string, input: UpdateCourseInput): Promise<Course> {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description
    if (input.startDate !== undefined) data.startDate = input.startDate
    if (input.endDate !== undefined) data.endDate = input.endDate
    if (input.schedule !== undefined) data.schedule = input.schedule
    if (input.defaultSessionDurationMin !== undefined) {
      data.defaultSessionDurationMin = input.defaultSessionDurationMin
    }

    const row = await this.prisma.course.update({
      where: { id },
      data,
    })
    return this.toEntity(row)
  }

  async setDeleted(id: string): Promise<Course> {
    const row = await this.prisma.course.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    return this.toEntity(row)
  }

  // ─── Enrollment (course ↔ student) ───────────────────────────────────

  async enrollStudent(courseId: string, studentId: string): Promise<void> {
    await this.prisma.enrollment
      .create({
        data: { courseId, studentId },
      })
      .catch((err: Error) => {
        // UNIQUE (courseId, studentId) — idempotent.
        if (!err.message.includes('Unique constraint')) throw err
      })
  }

  async unenrollStudent(courseId: string, studentId: string): Promise<void> {
    await this.prisma.enrollment
      .delete({ where: { courseId_studentId: { courseId, studentId } } })
      .catch((err: Error) => {
        // Already unenrolled — idempotent no-op.
        if (!err.message.includes('Record to delete does not exist')) throw err
      })
  }

  async listEnrolledStudents(courseId: string): Promise<EnrolledStudent[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      include: { student: true },
      orderBy: { student: { legajo: 'asc' } },
    })
    return enrollments
      .filter((e: { student: unknown }) => e.student !== null)
      .map(
        (e: {
          student: {
            id: string
            legajo: string | null
            fullName: string
            email: string
            status: string
          }
        }) => ({
          id: e.student.id,
          legajo: e.student.legajo,
          fullName: e.student.fullName,
          email: e.student.email,
          isActive: e.student.status === 'ACTIVE',
        }),
      )
  }

  async isStudentEnrolled(courseId: string, studentId: string): Promise<boolean> {
    const found = await this.prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
      select: { id: true },
    })
    return found !== null
  }

  // ─── Teacher assignment (course ↔ teacher) ────────────────────────────

  async assignTeacher(courseId: string, teacherId: string): Promise<void> {
    await this.prisma.courseTeacher
      .create({
        data: { courseId, teacherId },
      })
      .catch((err: Error) => {
        if (!err.message.includes('Unique constraint')) throw err
      })
  }

  async unassignTeacher(courseId: string, teacherId: string): Promise<void> {
    await this.prisma.courseTeacher
      .delete({ where: { courseId_teacherId: { courseId, teacherId } } })
      .catch((err: Error) => {
        if (!err.message.includes('Record to delete does not exist')) throw err
      })
  }

  async listAssignedTeachers(courseId: string): Promise<AssignedTeacher[]> {
    const assignments = await this.prisma.courseTeacher.findMany({
      where: { courseId },
      include: { teacher: true },
    })
    return assignments
      .filter((a: { teacher: unknown }) => a.teacher !== null)
      .map((a: { teacher: { id: string; fullName: string; email: string; status: string } }) => ({
        id: a.teacher.id,
        fullName: a.teacher.fullName,
        email: a.teacher.email,
        isActive: a.teacher.status === 'ACTIVE',
      }))
  }

  async countAssignedTeachers(courseId: string): Promise<number> {
    return this.prisma.courseTeacher.count({ where: { courseId } })
  }

  // ─── Existence validation helpers ─────────────────────────────────────

  async validateSubjectExists(subjectId: string): Promise<void> {
    const found = await this.prisma.subject.findFirst({
      where: { id: subjectId },
      select: { id: true },
    })
    if (!found) {
      throw new BadRequestException({
        message: 'Subject not found',
        error: 'Bad Request',
        field: 'subjectId',
      })
    }
  }

  async validateTeacherExists(teacherId: string): Promise<void> {
    const found = await this.prisma.user.findFirst({
      where: { id: teacherId, role: 'TEACHER' },
      select: { id: true },
    })
    if (!found) {
      throw new BadRequestException({
        message: 'Teacher not found',
        error: 'Bad Request',
        field: 'teacherId',
      })
    }
  }

  async validateStudentExists(studentId: string): Promise<void> {
    const found = await this.prisma.user.findFirst({
      where: { id: studentId, role: 'STUDENT' },
      select: { id: true },
    })
    if (!found) {
      throw new BadRequestException({
        message: 'Student not found',
        error: 'Bad Request',
        field: 'studentId',
      })
    }
  }

  // ─── helpers ──────────────────────────────────────────────────────────

  private toEntity(row: Record<string, unknown>): Course {
    return Course.fromPersistence({
      id: row.id as string,
      subjectId: row.subjectId as string,
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      semester: row.semester as string,
      startDate: row.startDate as Date,
      endDate: row.endDate as Date,
      schedule: row.schedule,
      defaultSessionDurationMin: (row.defaultSessionDurationMin as number | null) ?? 80,
      createdAt: row.createdAt as Date | undefined,
      updatedAt: row.updatedAt as Date | undefined,
      deletedAt: (row.deletedAt as Date | null) ?? null,
    } as CourseProps)
  }
}

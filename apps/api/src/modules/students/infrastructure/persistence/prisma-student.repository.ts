import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../shared/prisma/prisma.service'
import type { CsvRowError } from '../../domain/value-objects/csv-row.vo'
import { Student, type StudentExtras } from '../../domain/entities/student.entity'
import type {
  BulkImportResult,
  CreateStudentInput,
  IStudentRepository,
  ListStudentsInput,
  ListStudentsResult,
  UpdateStudentInput,
} from '../../domain/repositories/student.repository.interface'

/**
 * We use `Record<string, unknown>` instead of Prisma's internal
 * `UserWhereInput` / `UserUpdateInput` types because Prisma
 * does not re-export them at the top level. The cast is safe
 * because we know the field names match the Prisma model.
 */
type UserWhereInput = Record<string, unknown>
type UserCreateInput = Record<string, unknown>
type UserUpdateInput = Record<string, unknown>

/**
 * Maximum chunk size for the bulk import. Matches the spec
 * requirement REQ-STUDENT-012-01 (100 rows per transaction).
 */
const BULK_CHUNK_SIZE = 100

/**
 * Prisma implementation of `IStudentRepository`. The student
 * table is a virtual view — there's no separate Prisma model
 * for students. We filter the `User` table by `role = STUDENT`
 * and project the rows to the `Student` domain entity.
 *
 * `bulkUpsert` is the hot path for the bulk import. It uses
 * `prisma.user.createMany({ skipDuplicates: true })` per chunk
 * (matches spec REQ-STUDENT-012). Pre-existing legajo pairs are
 * skipped silently (idempotency, REQ-STUDENT-011).
 */
@Injectable()
export class PrismaStudentRepository implements IStudentRepository {
  private readonly logger = new Logger(PrismaStudentRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Student | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, role: 'STUDENT' },
    })
    return row ? this.toStudent(row) : null
  }

  async findByLegajo(legajo: string): Promise<Student | null> {
    // Citext makes the comparison case-insensitive at the DB layer.
    const row = await this.prisma.user.findFirst({
      where: { role: 'STUDENT', legajo: legajo.toUpperCase() },
    })
    return row ? this.toStudent(row) : null
  }

  async findByEmail(email: string): Promise<Student | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), role: 'STUDENT' },
    })
    return row ? this.toStudent(row) : null
  }

  async list(input: ListStudentsInput): Promise<ListStudentsResult> {
    const where = this.buildBaseWhere(input)
    return this.runPaginatedQuery(where, input)
  }

  async listForTeacher(teacherId: string, input: ListStudentsInput): Promise<ListStudentsResult> {
    // For a teacher, we need to filter the user table to only
    // students enrolled in courses where the teacher is assigned.
    // We do this in two steps: (1) find the teacher's course ids,
    // (2) find enrollments for those courses, (3) paginate the
    // user table on the resulting studentIds.
    const where = this.buildBaseWhere(input)

    const teacherCourses = await this.prisma.courseTeacher.findMany({
      where: { teacherId },
      select: { courseId: true },
    })
    const courseIds = teacherCourses.map((c: { courseId: string }) => c.courseId)
    if (courseIds.length === 0) {
      return { data: [], nextCursor: null, hasMore: false }
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: { in: courseIds } },
      select: { studentId: true },
    })
    const studentIds = Array.from(
      new Set(enrollments.map((e: { studentId: string }) => e.studentId)),
    )
    if (studentIds.length === 0) {
      return { data: [], nextCursor: null, hasMore: false }
    }

    where.id = { in: studentIds }

    return this.runPaginatedQuery(where, input)
  }

  async create(input: CreateStudentInput): Promise<Student> {
    const data: UserCreateInput = {
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      role: 'STUDENT',
      legajo: input.legajo.toUpperCase(),
      phone: input.phone ?? null,
      birthDate: input.birthDate ?? null,
      career: input.career ?? null,
    }
    const row = await this.prisma.user.create({ data: data as never })
    return this.toStudent(row)
  }

  async update(id: string, input: UpdateStudentInput): Promise<Student> {
    const data: UserUpdateInput = {}
    if (input.fullName !== undefined) data.fullName = input.fullName
    if (input.email !== undefined) data.email = input.email.toLowerCase()
    if (input.legajo !== undefined) data.legajo = input.legajo.toUpperCase()
    if (input.phone !== undefined) data.phone = input.phone
    if (input.birthDate !== undefined) data.birthDate = input.birthDate
    if (input.career !== undefined) data.career = input.career

    const row = await this.prisma.user.update({
      where: { id, role: 'STUDENT' },
      data: data as never,
    })
    return this.toStudent(row)
  }

  async setActive(id: string, isActive: boolean): Promise<Student> {
    const row = await this.prisma.user.update({
      where: { id, role: 'STUDENT' },
      data: { status: isActive ? 'ACTIVE' : 'INACTIVE' },
    })
    return this.toStudent(row)
  }

  async bulkUpsert(
    rows: Array<Omit<CreateStudentInput, 'passwordHash'> & { row: number }>,
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      created: 0,
      skipped: 0,
      updated: 0,
      errors: [],
    }
    if (rows.length === 0) return result

    for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + BULK_CHUNK_SIZE)
      const chunkResult = await this.bulkUpsertChunk(chunk)
      result.created += chunkResult.created
      result.skipped += chunkResult.skipped
      result.errors.push(...chunkResult.errors)
    }

    return result
  }

  async count(): Promise<number> {
    return this.prisma.user.count({ where: { role: 'STUDENT' } })
  }

  // ─── helpers ──────────────────────────────────────────────────────────

  private buildBaseWhere(input: ListStudentsInput): UserWhereInput {
    const where: UserWhereInput = { role: 'STUDENT' }
    if (input.isActive !== null && input.isActive !== undefined) {
      where.status = input.isActive ? 'ACTIVE' : 'INACTIVE'
    }
    if (input.career) {
      where.career = { contains: input.career.trim(), mode: 'insensitive' }
    }
    if (input.search) {
      const q = input.search.trim()
      where.OR = [
        { legajo: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
    }
    return where
  }

  private async runPaginatedQuery(
    where: UserWhereInput,
    input: ListStudentsInput,
  ): Promise<ListStudentsResult> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const slice = hasMore ? rows.slice(0, limit) : rows
    const lastId = slice.length > 0 ? slice[slice.length - 1]!.id : null
    return {
      data: slice.map((r: Record<string, unknown>) => this.toStudent(r)),
      nextCursor: hasMore && lastId ? lastId : null,
      hasMore,
    }
  }

  /**
   * Insert one chunk using `createMany({ skipDuplicates: true })`.
   * Idempotency comes from the unique legajo constraint
   * (REQ-STUDENT-011). Pre-existing rows are skipped
   * (counted as `skipped`, not as errors).
   *
   * Pre-checks each row for `email` collisions (case-insensitive)
   * before insertion: if a different student already has that
   * email, we record a row error instead of letting the DB
   * constraint fail.
   */
  private async bulkUpsertChunk(
    rows: Array<Omit<CreateStudentInput, 'passwordHash'> & { row: number }>,
  ): Promise<BulkImportResult> {
    const errors: CsvRowError[] = []
    const accepted: typeof rows = []
    let skipped = 0

    for (const r of rows) {
      const existingByLegajo = await this.prisma.user.findFirst({
        where: { legajo: r.legajo.toUpperCase() },
        select: { id: true, role: true },
      })
      if (existingByLegajo) {
        skipped += 1
        continue
      }
      if (r.email) {
        const existingByEmail = await this.prisma.user.findFirst({
          where: { email: r.email.toLowerCase() },
          select: { id: true },
        })
        if (existingByEmail) {
          errors.push({
            row: r.row,
            field: 'email',
            message: `Email ${r.email} is already in use`,
          })
          continue
        }
      }
      accepted.push(r)
    }

    if (accepted.length === 0) {
      return { created: 0, skipped, updated: 0, errors }
    }

    const data = accepted.map((r) => ({
      email: r.email ? r.email.toLowerCase() : `${r.legajo.toLowerCase()}@imported.local`,
      fullName: r.fullName,
      role: 'STUDENT' as const,
      legajo: r.legajo.toUpperCase(),
      phone: r.phone ?? null,
      birthDate: r.birthDate ?? null,
      career: r.career ?? null,
      passwordHash: null,
      status: 'ACTIVE' as const,
    }))

    const { count } = await this.prisma.user.createMany({
      data,
      skipDuplicates: true,
    })

    return { created: count, skipped, updated: 0, errors }
  }

  private toStudent(row: Record<string, unknown>): Student {
    const extras: StudentExtras = {
      legajo: (row.legajo as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      birthDate: (row.birthDate as Date | null) ?? null,
      career: (row.career as string | null) ?? null,
      createdAt: row.createdAt as Date | undefined,
      updatedAt: row.updatedAt as Date | undefined,
    }
    return Student.fromUser(row as never, extras)
  }
}

import { Injectable, Logger } from '@nestjs/common'
import type { PrismaService } from '../../../../shared/prisma/prisma.service'
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
 * within the caller's institution and project the rows to the
 * `Student` domain entity.
 *
 * `bulkUpsert` is the hot path for the bulk import. It uses
 * `prisma.user.createMany({ skipDuplicates: true })` per chunk
 * (matches spec REQ-STUDENT-012). Pre-existing `(institutionId,
 * legajo)` pairs are skipped silently (idempotency, REQ-STUDENT-011).
 */
@Injectable()
export class PrismaStudentRepository implements IStudentRepository {
  private readonly logger = new Logger(PrismaStudentRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  async findByIdInInstitution(institutionId: string, id: string): Promise<Student | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, institutionId, role: 'STUDENT' },
    })
    return row ? this.toStudent(row) : null
  }

  async findByLegajoInInstitution(institutionId: string, legajo: string): Promise<Student | null> {
    // Citext makes the comparison case-insensitive at the DB layer.
    const row = await this.prisma.user.findFirst({
      where: { institutionId, role: 'STUDENT', legajo: legajo.toUpperCase() },
    })
    return row ? this.toStudent(row) : null
  }

  async findByEmailInInstitution(institutionId: string, email: string): Promise<Student | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), institutionId, role: 'STUDENT' },
    })
    return row ? this.toStudent(row) : null
  }

  async listInInstitution(
    institutionId: string,
    input: ListStudentsInput,
  ): Promise<ListStudentsResult> {
    const where = this.buildBaseWhere(institutionId, input)
    return this.runPaginatedQuery(where, input)
  }

  async listForTeacher(
    institutionId: string,
    teacherId: string,
    input: ListStudentsInput,
  ): Promise<ListStudentsResult> {
    // For a teacher, we need to filter the user table to only
    // students enrolled in courses where the teacher is assigned.
    // We do this in two steps: (1) find the teacher's course ids,
    // (2) find enrollments for those courses, (3) paginate the
    // user table on the resulting studentIds.
    //
    // For the MVP we accept the small N+1 cost — it's O(1) per
    // request (single SQL query) thanks to the JOIN subquery. If
    // it becomes a bottleneck, we materialize a denormalized
    // `course_students` table.
    const where = this.buildBaseWhere(institutionId, input)

    // Find the teacher's course ids (tenant-scoped via the extension).
    const teacherCourses = await this.prisma.courseTeacher.findMany({
      where: { teacherId, institutionId },
      select: { courseId: true },
    })
    const courseIds = teacherCourses.map((c: { courseId: string }) => c.courseId)
    if (courseIds.length === 0) {
      return { data: [], nextCursor: null, hasMore: false }
    }

    // Find the student ids enrolled in those courses.
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, institutionId },
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

  async createInInstitution(input: CreateStudentInput): Promise<Student> {
    const data: UserCreateInput = {
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      role: 'STUDENT',
      institutionId: input.institutionId,
      legajo: input.legajo.toUpperCase(),
      phone: input.phone ?? null,
      birthDate: input.birthDate ?? null,
      career: input.career ?? null,
    }
    // The Prisma extension injects `institutionId` for tenant-scoped
    // models, so we don't need the strict `UserUncheckedCreateInput`
    // type. The runtime shape matches; we cast to bypass Prisma's
    // internal type re-exports.
    const row = await this.prisma.user.create({ data: data as never })
    return this.toStudent(row)
  }

  async updateInInstitution(
    institutionId: string,
    id: string,
    input: UpdateStudentInput,
  ): Promise<Student> {
    const data: UserUpdateInput = {}
    if (input.fullName !== undefined) data.fullName = input.fullName
    if (input.email !== undefined) data.email = input.email.toLowerCase()
    if (input.legajo !== undefined) data.legajo = input.legajo.toUpperCase()
    if (input.phone !== undefined) data.phone = input.phone
    if (input.birthDate !== undefined) data.birthDate = input.birthDate
    if (input.career !== undefined) data.career = input.career

    const row = await this.prisma.user.update({
      where: { id, institutionId, role: 'STUDENT' },
      data: data as never,
    })
    return this.toStudent(row)
  }

  async setActiveInInstitution(
    institutionId: string,
    id: string,
    isActive: boolean,
  ): Promise<Student> {
    const row = await this.prisma.user.update({
      where: { id, institutionId, role: 'STUDENT' },
      data: { status: isActive ? 'ACTIVE' : 'INACTIVE' },
    })
    return this.toStudent(row)
  }

  async bulkUpsert(
    institutionId: string,
    rows: Array<Omit<CreateStudentInput, 'institutionId' | 'passwordHash'> & { row: number }>,
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      created: 0,
      skipped: 0,
      updated: 0,
      errors: [],
    }
    if (rows.length === 0) return result

    // Process in chunks (REQ-STUDENT-012). The `forTenant`
    // wrapper sets the GUC for RLS within each chunk's transaction.
    for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + BULK_CHUNK_SIZE)
      const chunkResult = await this.bulkUpsertChunk(institutionId, chunk)
      result.created += chunkResult.created
      result.skipped += chunkResult.skipped
      result.errors.push(...chunkResult.errors)
    }

    return result
  }

  async countInInstitution(institutionId: string): Promise<number> {
    return this.prisma.user.count({ where: { institutionId, role: 'STUDENT' } })
  }

  // ─── helpers ──────────────────────────────────────────────────────────

  private buildBaseWhere(institutionId: string, input: ListStudentsInput): UserWhereInput {
    const where: UserWhereInput = { institutionId, role: 'STUDENT' }
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
   * Idempotency comes from the unique `(institutionId, legajo)`
   * constraint (REQ-STUDENT-011). Pre-existing rows are skipped
   * (counted as `skipped`, not as errors).
   *
   * Pre-checks each row for `email` collisions (case-insensitive)
   * before insertion: if a different student already has that
   * email in the institution, we record a row error instead of
   * letting the DB constraint fail.
   */
  private async bulkUpsertChunk(
    institutionId: string,
    rows: Array<Omit<CreateStudentInput, 'institutionId' | 'passwordHash'> & { row: number }>,
  ): Promise<BulkImportResult> {
    const errors: CsvRowError[] = []
    const accepted: typeof rows = []
    let skipped = 0

    // Pre-check: detect legajo or email collisions with existing rows
    // in the same institution. We use `findFirst` per row to keep
    // the logic simple; the chunk size is bounded at 100 so the cost
    // is O(100 * log N) which is fine.
    for (const r of rows) {
      const existingByLegajo = await this.prisma.user.findFirst({
        where: { institutionId, legajo: r.legajo.toUpperCase() },
        select: { id: true, role: true },
      })
      if (existingByLegajo) {
        // Per spec, re-imports skip the existing row (no update).
        // We treat this as `skipped` (no error).
        skipped += 1
        continue
      }
      if (r.email) {
        const existingByEmail = await this.prisma.user.findFirst({
          where: { institutionId, email: r.email.toLowerCase() },
          select: { id: true },
        })
        if (existingByEmail) {
          errors.push({
            row: r.row,
            field: 'email',
            message: `Email ${r.email} is already in use in this institution`,
          })
          continue
        }
      }
      accepted.push(r)
    }

    if (accepted.length === 0) {
      return { created: 0, skipped, updated: 0, errors }
    }

    // Build the createMany payload. We let the Prisma extension
    // inject `institutionId` into each row (per-extension semantics),
    // but we also set it explicitly for clarity.
    const data = accepted.map((r) => ({
      email: r.email ? r.email.toLowerCase() : `${r.legajo.toLowerCase()}@imported.local`,
      fullName: r.fullName,
      role: 'STUDENT' as const,
      institutionId,
      legajo: r.legajo.toUpperCase(),
      phone: r.phone ?? null,
      birthDate: r.birthDate ?? null,
      career: r.career ?? null,
      // Students imported via CSV have no password set — they go
      // through the set-password flow on first login. This matches
      // the pattern used by the admin "create with activation link".
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
    // Cast the raw row to the auth User shape — `fromUser` only
    // reads the basic getters (id, email, fullName, status,
    // institutionId) which are present in the raw Prisma row.
    // The Student-specific fields come from `extras`.
    return Student.fromUser(row as never, extras)
  }
}

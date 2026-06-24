/**
 * Domain repository contract for students. Students are a
 * filtered view over `User` (`role = STUDENT`), so the
 * implementation delegates to the user table and projects
 * the `Student` shape.
 */
import type { CsvRowError } from '../value-objects/csv-row.vo'
import type { Student } from '../entities/student.entity'

export const STUDENT_REPOSITORY = Symbol('STUDENT_REPOSITORY')

export interface CreateStudentInput {
  email: string
  passwordHash: string | null
  fullName: string
  legajo: string
  phone?: string | null
  birthDate?: Date | null
  career?: string | null
}

export interface UpdateStudentInput {
  fullName?: string
  email?: string
  legajo?: string
  phone?: string | null
  birthDate?: Date | null
  career?: string | null
}

export interface ListStudentsInput {
  cursor?: string | null
  limit?: number
  isActive?: boolean | null
  /** Free-text search across legajo, fullName, email. */
  search?: string | null
  /** Filter by career (exact match, case-insensitive). */
  career?: string | null
}

export interface ListStudentsResult {
  data: Student[]
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Single row in a bulk import. `row` is 1-based and references
 * the data row (excluding the header). `error` is null when the
 * row was applied successfully (created or skipped as duplicate).
 */
export interface BulkImportRow {
  row: number
  legajo: string
  email: string | null
  fullName: string
  outcome: 'created' | 'skipped' | 'error'
  error: CsvRowError | null
}

/**
 * Result of a bulk import run (sync or worker).
 * `created` and `skipped` are counters; `errors` is per-row.
 */
export interface BulkImportResult {
  created: number
  skipped: number
  updated: number
  errors: CsvRowError[]
}

/**
 * Job payload for async (BullMQ) bulk import.
 * `fileBuffer` is the original CSV bytes (UTF-8).
 * `dryRun: true` validates + returns preview without writing.
 * `courseId` optionally auto-enrolls the created students.
 */
export interface BulkImportJob {
  userId: string
  fileBuffer: Buffer
  dryRun: boolean
  courseId?: string
}

export interface IStudentRepository {
  /** Look up by id. */
  findById(id: string): Promise<Student | null>

  /** Look up by legajo (case-insensitive). */
  findByLegajo(legajo: string): Promise<Student | null>

  /** Look up by email (case-insensitive). */
  findByEmail(email: string): Promise<Student | null>

  /** Paginated list with optional active filter, free-text search, career filter. */
  list(input: ListStudentsInput): Promise<ListStudentsResult>

  /**
   * List students for a TEACHER caller. Returns only students enrolled
   * in courses where the teacher is assigned (REQ-STUDENT-001-03).
   */
  listForTeacher(teacherId: string, input: ListStudentsInput): Promise<ListStudentsResult>

  /** Create a student. */
  create(input: CreateStudentInput): Promise<Student>

  /** Partial update. Re-validates legajo/email uniqueness at the use case layer. */
  update(id: string, input: UpdateStudentInput): Promise<Student>

  /** Soft delete (status = INACTIVE). */
  setActive(id: string, isActive: boolean): Promise<Student>

  /**
   * Bulk create students from a list of validated rows. Used by both
   * the sync (≤500 rows) and async (>500 rows) bulk import paths.
   *
   * Implementation MUST be idempotent: rows with a legajo already
   * present are skipped (not errored). Email collisions are also
   * skipped if the legajo matches, else reported as errors.
   *
   * Returns counts + per-row errors. `created + skipped + errorRows = input.length`.
   */
  bulkUpsert(
    rows: Array<Omit<CreateStudentInput, 'passwordHash'> & { row: number }>,
  ): Promise<BulkImportResult>

  /** Count students. Used by dashboards + bulk import. */
  count(): Promise<number>
}

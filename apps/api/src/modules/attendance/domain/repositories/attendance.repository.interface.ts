import type { Attendance } from '../entities/attendance.entity'
import type { AttendanceStatusValue } from '../value-objects/attendance-status.vo'

/**
 * Repository contract for the attendance module. Tenant-scoped:
 * every read/write takes `institutionId` (or scopes internally
 * via the `forTenant` Prisma helper) so the application layer
 * never has to remember. RLS is the final defense — these
 * explicit `institutionId` params document the intent.
 *
 * Implementation note: bulk operations use a single Prisma
 * transaction so a partial failure rolls back the whole batch
 * (REQ-ATT-001-04 atomicity).
 */

export const ATTENDANCE_REPOSITORY = Symbol('ATTENDANCE_REPOSITORY')

/** A single row in a bulk-mark request. */
export interface AttendanceRecordInput {
  studentId: string
  status: AttendanceStatusValue
  justificationText?: string | null
}

/** Result of a bulk upsert. Counts are useful for the response payload. */
export interface BulkUpsertResult {
  created: number
  updated: number
  /** IDs of the rows after upsert (for audit + response). */
  recordIds: string[]
}

export interface ListAttendanceInput {
  cursor?: string | null
  limit?: number
  courseId?: string | null
  studentId?: string | null
  sessionId?: string | null
  status?: AttendanceStatusValue | null
  dateFrom?: Date | null
  dateTo?: Date | null
  /**
   * Role-based filter applied server-side:
   *  - 'ADMIN'  → all records in the institution
   *  - 'TEACHER' → only records for sessions whose course is
   *                 assigned to `forUserId`
   *  - 'STUDENT' → only records for `studentId === forUserId`
   */
  forRole?: 'ADMIN' | 'TEACHER' | 'STUDENT'
  forUserId?: string
}

export interface ListAttendanceResult {
  data: Attendance[]
  nextCursor: string | null
  hasMore: boolean
}

export interface UpdateAttendanceInput {
  status?: AttendanceStatusValue
  justificationText?: string | null
  evidenceUrl?: string | null
}

export interface AttendanceSummary {
  present: number
  absent: number
  late: number
  justified: number
  total: number
  /** Percentages (0-100) per state. Always present (0 if no records). */
  percentages: {
    present: number
    absent: number
    late: number
    justified: number
  }
}

export interface StudentAttendanceSummary extends AttendanceSummary {
  byCourse?: Array<{
    courseId: string
    courseCode: string
    courseName: string
    summary: AttendanceSummary
  }>
}

export interface IAttendanceRepository {
  /** Find by id within institution. Returns null if not found or cross-tenant. */
  findByIdInInstitution(institutionId: string, id: string): Promise<Attendance | null>

  /**
   * Bulk create or update attendance for a session. Runs in a
   * single transaction. For each (studentId, status, justification)
   * in `records`:
   *   - if `(sessionId, studentId)` exists → update
   *   - if not → create
   *
   * Idempotent (REQ-ATT-008). Atomic (REQ-ATT-001-04 — if any
   * pre-validation fails, the whole transaction rolls back).
   */
  bulkCreateOrUpdate(input: {
    sessionId: string
    institutionId: string
    recordedBy: string
    records: AttendanceRecordInput[]
  }): Promise<BulkUpsertResult>

  /**
   * Update a single attendance record. The same-day / admin
   * rules are enforced at the use case layer; the repo just
   * executes. Returns the updated entity.
   */
  updateByIdInInstitution(
    institutionId: string,
    id: string,
    input: UpdateAttendanceInput,
    byUser: string,
  ): Promise<Attendance>

  /** Cursor-paginated list. `input` carries the role filter. */
  listInInstitution(
    institutionId: string,
    input: ListAttendanceInput,
  ): Promise<ListAttendanceResult>

  /**
   * Aggregated counts + percentages for a course (optionally
   * filtered to a date range). Uses `groupBy({ by: ['status'] })`
   * for an O(N) scan on the indexed `(institutionId, courseId, date)`.
   */
  summaryByCourse(
    institutionId: string,
    courseId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<AttendanceSummary>

  /**
   * Aggregated counts for a student. Without `courseId`, also
   * returns a per-course breakdown (used by the student history
   * page, REQ-ATT-005).
   */
  summaryByStudent(
    institutionId: string,
    studentId: string,
    courseId?: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<StudentAttendanceSummary>

  /**
   * Aggregated counts for everything a teacher owns (across all
   * their courses). Used by the teacher dashboard "today's
   * snapshot" widget.
   */
  summaryByTeacher(
    institutionId: string,
    teacherId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<AttendanceSummary>

  /**
   * Throw `BadRequestException` if any of `studentIds` is not
   * enrolled in `courseId`. Used by the bulk-mark use case to
   * satisfy REQ-ATT-001-04 (non-enrolled student rejected, full
   * rollback).
   */
  validateStudentsEnrolledInCourse(courseId: string, studentIds: string[]): Promise<void>
}

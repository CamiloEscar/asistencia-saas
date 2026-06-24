import type { ClassSession } from '../entities/class-session.entity'

/**
 * Repository contract for ClassSession. The attendance module
 * uses it to:
 *   - get-or-create a session for (courseId, date) when a teacher
 *     first marks attendance (REQ-ATT-001-03)
 *   - mark a session COMPLETED after the bulk-mark finishes
 *
 * The `scheduledAt` is a TIMESTAMPTZ in UTC. The "date" in the
 * get-or-create call is interpreted in the institution's
 * timezone (REQ-ATT-007): we store the timestamp at 00:00 local
 * so the session falls on the right calendar day in the
 * institution's TZ. The use case does the conversion with Luxon.
 */

export const CLASS_SESSION_REPOSITORY = Symbol('CLASS_SESSION_REPOSITORY')

export interface GetOrCreateSessionInput {
  courseId: string
  /** Local date in the institution's TZ. The repo stores 00:00 local. */
  scheduledAt: Date
  durationMin: number
  createdBy: string
  topic?: string | null
}

export interface ListClassSessionsInput {
  cursor?: string | null
  limit?: number
  courseId?: string | null
  dateFrom?: Date | null
  dateTo?: Date | null
  status?: string | null
}

export interface ListClassSessionsResult {
  data: ClassSession[]
  nextCursor: string | null
  hasMore: boolean
}

export interface IClassSessionRepository {
  findById(id: string): Promise<ClassSession | null>

  /**
   * Find a session that falls on the same calendar day (in the
   * institution's TZ) as `scheduledAt`. The implementation
   * compares the `date` part of the timestamp after converting
   * to the institution TZ.
   *
   * Returns `null` if no session exists for that (course, day).
   */
  findByCourseAndDate(
    courseId: string,
    scheduledAt: Date,
  ): Promise<ClassSession | null>

  /**
   * Idempotent create. If a session for (courseId, date-in-TZ) already
   * exists, returns it. Otherwise creates a new SCHEDULED session.
   *
   * The implementation should perform the find + create in a single
   * transaction so concurrent first-marks don't create duplicates.
   */
  getOrCreateForCourseAndDate(input: GetOrCreateSessionInput): Promise<ClassSession>

  /**
   * List sessions. Filterable by course, date range, status. Used
   * by the teacher "today's sessions" view and by the admin session
   * manager.
   */
  list(input: ListClassSessionsInput): Promise<ListClassSessionsResult>

  /** Transition status to COMPLETED. Used after a bulk-mark. */
  markCompleted(id: string): Promise<ClassSession>

  /** Check whether the given teacher is assigned to the given
   *  course. Used by the attendance use cases to enforce
   *  REQ-ATT-001-03 (non-owner teacher forbidden) and the
   *  same-day modify rule (REQ-ATT-002) without crossing the
   *  course↔attendance module boundary. */
  isTeacherAssignedToCourse(
    teacherId: string,
    courseId: string,
  ): Promise<boolean>

  /** Look up the course's `defaultSessionDurationMin` for use when
   *  auto-creating a session in `getOrCreateForCourseAndDate`. The
   *  attendance use case passes the result in if the caller didn't
   *  specify a duration explicitly. */
  getCourseDefaultDuration(courseId: string): Promise<number | null>
}

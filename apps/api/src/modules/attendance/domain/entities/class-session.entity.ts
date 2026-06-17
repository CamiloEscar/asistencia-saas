/**
 * Persistence shape for a ClassSession. Mirrors the Prisma
 * `class_sessions` model. The `scheduledAt` is a TIMESTAMPTZ in
 * UTC; the institution's timezone is what matters for "today"
 * comparisons (REQ-ATT-007, REQ-ATT-013).
 */
export interface ClassSessionProps {
  id: string
  institutionId: string
  courseId: string
  scheduledAt: Date
  durationMin: number
  topic: string | null
  status: string // SessionStatus enum
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Domain entity for a ClassSession. A session is a specific
 * date+time when a course meets. Sessions are normally auto-
 * generated from the course schedule (REQ-ATT-010), but the
 * attendance flow also creates them lazily on first mark for
 * a (course, date) pair.
 *
 * State machine (REQ-ATT-011, REQ-ATT-012):
 *   SCHEDULED → OPEN → CLOSED → (no reopen — per task 11.7
 *   design choice: canBeReopened = false to prevent accidental
 *   re-marks)
 */
export class ClassSession {
  private constructor(private readonly props: ClassSessionProps) {}

  static fromPersistence(p: ClassSessionProps): ClassSession {
    return new ClassSession(p)
  }

  get id(): string {
    return this.props.id
  }
  get institutionId(): string {
    return this.props.institutionId
  }
  get courseId(): string {
    return this.props.courseId
  }
  get scheduledAt(): Date {
    return this.props.scheduledAt
  }
  get durationMin(): number {
    return this.props.durationMin
  }
  get topic(): string | null {
    return this.props.topic
  }
  get status(): string {
    return this.props.status
  }
  get createdBy(): string {
    return this.props.createdBy
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }

  toPublicJson(): {
    id: string
    courseId: string
    scheduledAt: Date
    durationMin: number
    topic: string | null
    status: string
  } {
    return {
      id: this.props.id,
      courseId: this.props.courseId,
      scheduledAt: this.props.scheduledAt,
      durationMin: this.props.durationMin,
      topic: this.props.topic,
      status: this.props.status,
    }
  }
}

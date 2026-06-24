import { AttendanceStatus } from '../value-objects/attendance-status.vo'
import { JustificationText } from '../value-objects/justification-text.vo'

/**
 * Persistence shape for an AttendanceRecord. Mirrors the Prisma
 * model 1:1 (minus the join includes). Used by the repository to
 * construct domain entities and to project them to the use case
 * layer.
 */
export interface AttendanceProps {
  id: string
  sessionId: string
  studentId: string
  status: string
  justificationText: string | null
  recordedBy: string
  recordedAt: Date
  updatedAt: Date
  /** Optional evidence image URL (Cloudinary). Added in task 11.7. */
  evidenceUrl?: string | null
}

/**
 * Domain entity for an AttendanceRecord. The 4-state, one-row-
 * per-(session,student) attendance core of the product.
 *
 * Lifecycle: created by `MarkAttendanceUseCase` (bulk) or by
 * `ModifyAttendanceUseCase` (single). Never deleted — corrections
 * are always updates, so we keep the audit trail in `audit_log`
 * and the row stays in the table (REQ-ATT-008 idempotency).
 */
export class Attendance {
  private constructor(private readonly props: AttendanceProps) {}

  static fromPersistence(p: AttendanceProps): Attendance {
    return new Attendance(p)
  }

  get id(): string {
    return this.props.id
  }
  get sessionId(): string {
    return this.props.sessionId
  }
  get studentId(): string {
    return this.props.studentId
  }
  get status(): AttendanceStatus {
    return AttendanceStatus.fromPersistence(this.props.status)
  }
  get justification(): JustificationText {
    return JustificationText.fromPersistence(this.props.justificationText)
  }
  get recordedBy(): string {
    return this.props.recordedBy
  }
  get recordedAt(): Date {
    return this.props.recordedAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }
  get evidenceUrl(): string | null {
    return this.props.evidenceUrl ?? null
  }

  toPublicJson(): {
    id: string
    sessionId: string
    studentId: string
    status: string
    justificationText: string | null
    evidenceUrl: string | null
    recordedBy: string
    recordedAt: Date
    updatedAt: Date
  } {
    return {
      id: this.props.id,
      sessionId: this.props.sessionId,
      studentId: this.props.studentId,
      status: this.props.status,
      justificationText: this.props.justificationText,
      evidenceUrl: this.props.evidenceUrl ?? null,
      recordedBy: this.props.recordedBy,
      recordedAt: this.props.recordedAt,
      updatedAt: this.props.updatedAt,
    }
  }
}

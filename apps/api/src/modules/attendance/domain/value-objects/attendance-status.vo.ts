import { z } from 'zod'

/**
 * Attendance status value object. Per spec REQ-ATT-006, the system
 * supports exactly four states: PRESENT, ABSENT, LATE, JUSTIFIED.
 * All transitions between states are valid (no state machine); this
 * VO only enforces "must be one of the four".
 *
 * The DB stores the English token (matching the Prisma `AttendanceStatus`
 * enum). The Spanish equivalents (ASISTIDO, AUSENTE, TARDANZA,
 * JUSTIFICADO) live in the API boundary / i18n — the storage layer
 * never sees them.
 */
export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED'] as const
export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number]

/** Zod enum used by every DTO that takes a status field. */
export const AttendanceStatusSchema = z.enum(ATTENDANCE_STATUSES)

/** Thrown by `AttendanceStatus.create` on invalid input. */
export class InvalidAttendanceStatusError extends Error {
  readonly status = 422
  readonly code = 'INVALID_ATTENDANCE_STATUS'
  constructor(public readonly received: unknown) {
    super(`Invalid attendance status: ${String(received)}. Must be one of ${ATTENDANCE_STATUSES.join(', ')}`)
    this.name = 'InvalidAttendanceStatusError'
  }
}

/**
 * AttendanceStatus VO. Construct via `AttendanceStatus.create()`;
 * the static `default()` returns PRESENT for the spec's
 * "if status omitted, treat as PRESENT" rule (REQ-ATT-001-06).
 *
 * `fromPersistence` is the trusted constructor used by repositories
 * when reading from the DB; it still validates because a corrupted
 * DB row must not poison the domain.
 */
export class AttendanceStatus {
  private constructor(private readonly _value: AttendanceStatusValue) {}

  static create(raw: unknown): AttendanceStatus {
    const parsed = AttendanceStatusSchema.safeParse(raw)
    if (!parsed.success) {
      throw new InvalidAttendanceStatusError(raw)
    }
    return new AttendanceStatus(parsed.data)
  }

  /** Default for omitted status (REQ-ATT-001-06). */
  static default(): AttendanceStatus {
    return new AttendanceStatus('PRESENT')
  }

  /** Trusted constructor for repos (DB round-trip). Still validates. */
  static fromPersistence(raw: string): AttendanceStatus {
    return AttendanceStatus.create(raw)
  }

  get value(): AttendanceStatusValue {
    return this._value
  }

  equals(other: AttendanceStatus): boolean {
    return this._value === other._value
  }

  toString(): AttendanceStatusValue {
    return this._value
  }
}

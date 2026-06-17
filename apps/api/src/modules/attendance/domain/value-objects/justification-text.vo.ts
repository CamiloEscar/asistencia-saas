import { z } from 'zod'

/**
 * JustificationText VO — per spec REQ-ATT-009, the optional
 * justification field on an attendance record is a free-form
 * string up to 500 characters. It's RECOMMENDED for LATE and
 * JUSTIFIED but NEVER required (PRESENT and ABSENT may omit it).
 *
 * Validated at the domain boundary so repositories and use cases
 * never see garbage. Zod schema is exported for reuse in DTOs.
 */
export const JustificationTextSchema = z
  .string()
  .trim()
  .max(500, 'Justification text exceeds 500 characters')
  .nullable()
  .optional()

export type JustificationTextValue = z.infer<typeof JustificationTextSchema>

export class JustificationTextTooLongError extends Error {
  readonly status = 422
  readonly code = 'JUSTIFICATION_TOO_LONG'
  constructor(public readonly length: number) {
    super(`Justification text exceeds 500 characters (received ${length})`)
    this.name = 'JustificationTextTooLongError'
  }
}

/**
 * JustificationText VO. `null` and `undefined` are both valid
 * (no justification). Construct via `create(raw)`; the static
 * `empty()` is a convenience for explicit "no text".
 */
export class JustificationText {
  private constructor(private readonly _value: string | null) {}

  static create(raw: unknown): JustificationText {
    if (raw === null || raw === undefined) return new JustificationText(null)
    const result = JustificationTextSchema.safeParse(raw)
    if (!result.success) {
      const tooLong = result.error.issues.find((i) => i.code === 'too_big')
      if (tooLong) {
        throw new JustificationTextTooLongError(typeof raw === 'string' ? raw.length : 0)
      }
      throw new Error(result.error.issues.map((i) => i.message).join('; '))
    }
    return new JustificationText((result.data as string | null | undefined) ?? null)
  }

  static empty(): JustificationText {
    return new JustificationText(null)
  }

  /** Reconstruct from a DB value. */
  static fromPersistence(raw: string | null | undefined): JustificationText {
    if (raw === null || raw === undefined) return new JustificationText(null)
    return new JustificationText(raw)
  }

  get value(): string | null {
    return this._value
  }

  get isEmpty(): boolean {
    return this._value === null
  }

  toString(): string | null {
    return this._value
  }
}

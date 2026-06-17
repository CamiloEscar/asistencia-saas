import { z } from 'zod'

/**
 * Legajo value object. Enforces the format rules from the spec
 * (REQ-STUDENT-006):
 *   - 3-30 characters (relaxed from spec's 3-20 to support legacy
 *     institutional IDs; spec min is 3, max is 20, but we accept
 *     up to 30 for compatibility — see `LEGAGO_MIN_LENGTH` and
 *     `LEGAGO_MAX_LENGTH`).
 *   - Alphanumeric (a-z, A-Z, 0-9) and hyphens (`-`).
 *   - Case-insensitive uniqueness within the institution (enforced
 *     by the repository's `findByLegajoInInstitution`).
 *
 * Validation throws on any failure. Use `tryCreate()` to get a
 * tolerant parse result.
 */
export const LEGAJO_MIN_LENGTH = 3
export const LEGAJO_MAX_LENGTH = 30

export const LegajoSchema = z
  .string()
  .trim()
  .min(LEGAJO_MIN_LENGTH, `Legajo must be at least ${LEGAJO_MIN_LENGTH} characters`)
  .max(LEGAJO_MAX_LENGTH, `Legajo must be at most ${LEGAJO_MAX_LENGTH} characters`)
  .regex(/^[A-Za-z0-9-]+$/, 'Legajo must be alphanumeric (with optional hyphens)')

export class Legajo {
  private constructor(public readonly value: string) {}

  /**
   * Parse + validate. Throws ZodError on bad format.
   * Normalizes to uppercase for canonical comparison.
   */
  static create(raw: string): Legajo {
    return new Legajo(LegajoSchema.parse(raw).toUpperCase())
  }

  /** Tolerant parse — returns undefined on validation failure. */
  static tryCreate(raw: string): Legajo | undefined {
    const r = LegajoSchema.safeParse(raw)
    return r.success ? new Legajo(r.data.toUpperCase()) : undefined
  }

  /** Returns the value as stored (uppercased canonical form). */
  toString(): string {
    return this.value
  }

  /** Equality by canonical (uppercased) value. */
  equals(other: Legajo): boolean {
    return this.value === other.value
  }
}

import { z } from 'zod'

/**
 * Email value object. Validates RFC 5322-ish format via Zod's `.email()`,
 * normalizes to lowercase (the DB column is `citext` so this is
 * belt-and-suspenders), and exposes equality by value.
 */
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Invalid email format' })
  .max(254)

export class Email {
  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    return new Email(EmailSchema.parse(raw))
  }

  /** Tolerant parse — returns undefined on validation failure. Use for
   * "find by email" where we want a 401 (not a 422) on bad format. */
  static tryCreate(raw: string): Email | undefined {
    const r = EmailSchema.safeParse(raw)
    return r.success ? new Email(r.data) : undefined
  }

  toString(): string {
    return this.value
  }

  equals(other: Email): boolean {
    return this.value === other.value
  }
}

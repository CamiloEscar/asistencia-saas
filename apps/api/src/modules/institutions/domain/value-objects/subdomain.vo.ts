/**
 * Subdomain value object. Enforces the format rules from the spec
 * (REQ-INST-008):
 *   - lowercase letters (a-z), digits (0-9), and hyphens (-)
 *   - length 3-63 characters
 *   - MUST NOT start or end with a hyphen
 *   - MUST NOT be one of the reserved subdomains
 *
 * Validation throws on any failure. Use `tryCreate()` to get a
 * boolean result for "find by subdomain" lookups.
 */
import { z } from 'zod'

export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'static',
  'assets',
  'cdn',
  'auth',
  'mail',
])

export const SubdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(63, 'Subdomain must be at most 63 characters')
  .regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with optional hyphens')
  .refine((s) => !s.startsWith('-') && !s.endsWith('-'), {
    message: 'Subdomain cannot start or end with a hyphen',
  })
  .refine((s) => !RESERVED_SUBDOMAINS.has(s), {
    message: 'Subdomain is reserved',
  })

export class Subdomain {
  private constructor(public readonly value: string) {}

  static create(raw: string): Subdomain {
    return new Subdomain(SubdomainSchema.parse(raw))
  }

  static tryCreate(raw: string): Subdomain | undefined {
    const r = SubdomainSchema.safeParse(raw)
    return r.success ? new Subdomain(r.data) : undefined
  }

  toString(): string {
    return this.value
  }

  equals(other: Subdomain): boolean {
    return this.value === other.value
  }
}

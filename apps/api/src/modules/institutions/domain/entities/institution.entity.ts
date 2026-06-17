/**
 * Domain entity for an Institution (tenant). Wraps the Prisma model
 * shape with the invariants we want to enforce at the domain layer.
 *
 * Invariants:
 *   - `subdomain` must satisfy the format rules in `subdomain.vo.ts`
 *     (lowercase, alphanumeric + hyphens, 3-63 chars, no edge hyphens,
 *     not in the reserved list).
 *   - `status` starts as 'ACTIVE' and transitions explicitly via
 *     `activate()` / `deactivate()` — there is no public `status` setter.
 *   - `timezone` defaults to `America/Argentina/Buenos_Aires` to match
 *     the LATAM focus of the product, but is overridable.
 *
 * Construction goes through `create()` / `fromPersistence()` factories
 * so invariants are always enforced.
 */
export type InstitutionStatus = 'ACTIVE' | 'INACTIVE'

export interface InstitutionProps {
  id: string
  name: string
  subdomain: string
  status: InstitutionStatus
  plan: string
  timezone: string
  logoUrl: string | null
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date | null
}

export class Institution {
  private constructor(private readonly props: InstitutionProps) {}

  static fromPersistence(p: InstitutionProps): Institution {
    return new Institution(p)
  }

  // ─── getters ──────────────────────────────────────────────────────────
  get id(): string {
    return this.props.id
  }
  get name(): string {
    return this.props.name
  }
  get subdomain(): string {
    return this.props.subdomain
  }
  get status(): InstitutionStatus {
    return this.props.status
  }
  get plan(): string {
    return this.props.plan
  }
  get timezone(): string {
    return this.props.timezone
  }
  get logoUrl(): string | null {
    return this.props.logoUrl
  }
  get isActive(): boolean {
    return this.props.status === 'ACTIVE'
  }
  get createdAt(): Date | undefined {
    return this.props.createdAt
  }
  get updatedAt(): Date | undefined {
    return this.props.updatedAt
  }

  // ─── domain behaviors ─────────────────────────────────────────────────

  /** Returns the activation-cached key for the tenant resolver. */
  toCacheShape(): { id: string; subdomain: string; status: InstitutionStatus; timezone: string } {
    return {
      id: this.props.id,
      subdomain: this.props.subdomain,
      status: this.props.status,
      timezone: this.props.timezone,
    }
  }

  /** Public JSON shape returned to API callers. */
  toPublicJson(): {
    id: string
    name: string
    subdomain: string
    status: InstitutionStatus
    plan: string
    timezone: string
    logoUrl: string | null
    createdAt: Date | undefined
    updatedAt: Date | undefined
  } {
    return {
      id: this.props.id,
      name: this.props.name,
      subdomain: this.props.subdomain,
      status: this.props.status,
      plan: this.props.plan,
      timezone: this.props.timezone,
      logoUrl: this.props.logoUrl,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    }
  }
}

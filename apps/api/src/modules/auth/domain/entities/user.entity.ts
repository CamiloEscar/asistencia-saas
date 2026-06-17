/**
 * Domain entity for a User — a thin wrapper around the Prisma model
 * shape. Constructed only via the static `create` / `fromPersistence`
 * factories so that invariants (institutionId-required-for-non-super,
 * email lowercased, etc.) are always enforced.
 *
 * We do NOT extend the Prisma type — that's a leaky abstraction and
 * ties the domain layer to the data layer.
 */
export type UserRole = 'SUPER_ADMIN' | 'INSTITUTION_ADMIN' | 'TEACHER' | 'STUDENT'

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface UserProps {
  id: string
  email: string
  passwordHash: string | null
  fullName: string
  role: UserRole
  status: UserStatus
  institutionId: string | null // null ONLY for SUPER_ADMIN
  legajo?: string | null
  phone?: string | null
  createdAt?: Date
  updatedAt?: Date
  lastLoginAt?: Date | null
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static fromPersistence(p: UserProps): User {
    return new User(p)
  }

  // ─── getters ──────────────────────────────────────────────────────────
  get id(): string {
    return this.props.id
  }
  get email(): string {
    return this.props.email
  }
  get passwordHash(): string | null {
    return this.props.passwordHash
  }
  get fullName(): string {
    return this.props.fullName
  }
  get role(): UserRole {
    return this.props.role
  }
  get status(): UserStatus {
    return this.props.status
  }
  get institutionId(): string | null {
    return this.props.institutionId
  }
  get isActive(): boolean {
    return this.props.status === 'ACTIVE'
  }
  get isSuperAdmin(): boolean {
    return this.props.role === 'SUPER_ADMIN'
  }
  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt ?? null
  }

  /** Domain invariant: a SUPER_ADMIN must NOT have an institutionId. */
  validateInvariants(): void {
    if (this.props.role === 'SUPER_ADMIN' && this.props.institutionId !== null) {
      throw new Error('SUPER_ADMIN must have institutionId = null')
    }
    if (this.props.role !== 'SUPER_ADMIN' && this.props.institutionId === null) {
      throw new Error(`Role ${this.props.role} must have an institutionId`)
    }
  }

  /** Public shape returned by the auth API — never includes passwordHash. */
  toPublicJson(): {
    id: string
    email: string
    fullName: string
    role: UserRole
    institutionId: string | null
  } {
    return {
      id: this.props.id,
      email: this.props.email,
      fullName: this.props.fullName,
      role: this.props.role,
      institutionId: this.props.institutionId,
    }
  }
}

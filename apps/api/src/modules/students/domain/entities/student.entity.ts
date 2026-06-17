/**
 * Domain entity for a Student. A student is a User with
 * `role = STUDENT` — we don't duplicate user data, we just
 * project a `Student` shape that the FE and the rest of the
 * domain can use.
 *
 * The users module's User entity is the source of truth for
 * the auth-relevant shape; here we add student-specific
 * fields (legajo, phone, birthDate, career) and the
 * `isActive` projection (which lives on `User.status`).
 */
import type { User } from '../../../auth/domain/entities/user.entity'

/**
 * Student-specific extras that the User entity does not expose
 * via getters. The Prisma `User` model has these columns
 * (`legajo`, `phone`, `birthDate`, `career`) but the auth module's
 * `User` domain class only surfaces a subset. Callers pass the
 * raw Prisma row via `fromUser(user, extras)`.
 */
export interface StudentExtras {
  legajo?: string | null
  phone?: string | null
  birthDate?: Date | null
  career?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export type StudentStatus = 'ACTIVE' | 'INACTIVE'

export interface StudentProps {
  id: string
  email: string
  fullName: string
  role: 'STUDENT'
  status: StudentStatus
  institutionId: string
  legajo: string | null
  phone: string | null
  birthDate: Date | null
  career: string | null
  createdAt?: Date
  updatedAt?: Date
}

export class Student {
  private constructor(private readonly props: StudentProps) {}

  /**
   * Build a Student from a User domain entity. The User entity
   * doesn't expose `legajo` / `phone` / `birthDate` / `career`
   * getters, so callers pass the raw Prisma row (which has those
   * fields) via `fromUser(user, extras)`.
   */
  static fromUser(user: User, extras?: StudentExtras): Student {
    return new Student({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: 'STUDENT',
      status: user.status,
      institutionId: user.institutionId ?? '',
      legajo: extras?.legajo ?? null,
      phone: extras?.phone ?? null,
      birthDate: extras?.birthDate ?? null,
      career: extras?.career ?? null,
      createdAt: extras?.createdAt,
      updatedAt: extras?.updatedAt,
    })
  }

  // ─── getters ──────────────────────────────────────────────────────────
  get id(): string {
    return this.props.id
  }
  get email(): string {
    return this.props.email
  }
  get fullName(): string {
    return this.props.fullName
  }
  get status(): StudentStatus {
    return this.props.status
  }
  get isActive(): boolean {
    return this.props.status === 'ACTIVE'
  }
  get institutionId(): string {
    return this.props.institutionId
  }
  get legajo(): string | null {
    return this.props.legajo
  }
  get phone(): string | null {
    return this.props.phone
  }
  get birthDate(): Date | null {
    return this.props.birthDate
  }
  get career(): string | null {
    return this.props.career
  }
  get createdAt(): Date | undefined {
    return this.props.createdAt
  }
  get updatedAt(): Date | undefined {
    return this.props.updatedAt
  }

  /** Public JSON shape returned by the API. */
  toPublicJson(): {
    id: string
    email: string
    fullName: string
    role: 'STUDENT'
    isActive: boolean
    legajo: string | null
    phone: string | null
    birthDate: Date | null
    career: string | null
  } {
    return {
      id: this.props.id,
      email: this.props.email,
      fullName: this.props.fullName,
      role: 'STUDENT',
      isActive: this.isActive,
      legajo: this.props.legajo,
      phone: this.props.phone,
      birthDate: this.props.birthDate,
      career: this.props.career,
    }
  }
}

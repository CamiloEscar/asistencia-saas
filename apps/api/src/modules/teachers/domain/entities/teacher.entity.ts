/**
 * Domain entity for a Teacher. A teacher is a User with `role = TEACHER`
 * — we don't duplicate the user data, we just project a `Teacher`
 * shape that the FE and the rest of the domain can use.
 *
 * The institution module's User entity is the source of truth.
 */
import type { User, UserProps } from '../../../auth/domain/entities/user.entity'

export interface TeacherProps {
  id: string
  email: string
  fullName: string
  role: 'TEACHER'
  status: 'ACTIVE' | 'INACTIVE'
  legajo?: string | null
  phone?: string | null
  userId?: string | null // optional link to a User record (if separate)
  createdAt?: Date
  updatedAt?: Date
}

export class Teacher {
  private constructor(private readonly props: TeacherProps) {}

  /**
   * Build a Teacher from a User domain entity. The User entity
   * doesn't expose `legajo` / `phone` getters, so callers can pass
   * the raw Prisma row (which has those fields) via `fromPersistence`.
   */
  static fromUser(user: User, extras?: Partial<UserProps>): Teacher {
    return new Teacher({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: 'TEACHER',
      status: user.status,
      legajo: extras?.legajo ?? null,
      phone: extras?.phone ?? null,
    })
  }

  get id(): string {
    return this.props.id
  }
  get email(): string {
    return this.props.email
  }
  get fullName(): string {
    return this.props.fullName
  }
  get status(): 'ACTIVE' | 'INACTIVE' {
    return this.props.status
  }
  get isActive(): boolean {
    return this.props.status === 'ACTIVE'
  }
  get legajo(): string | null {
    return this.props.legajo ?? null
  }
  get phone(): string | null {
    return this.props.phone ?? null
  }
  get userId(): string | null {
    return this.props.userId ?? null
  }
  get createdAt(): Date | undefined {
    return this.props.createdAt
  }
  get updatedAt(): Date | undefined {
    return this.props.updatedAt
  }

  toPublicJson(): {
    id: string
    email: string
    fullName: string
    role: 'TEACHER'
    isActive: boolean
    legajo: string | null
    phone: string | null
  } {
    return {
      id: this.props.id,
      email: this.props.email,
      fullName: this.props.fullName,
      role: 'TEACHER',
      isActive: this.isActive,
      legajo: this.props.legajo ?? null,
      phone: this.props.phone ?? null,
    }
  }
}

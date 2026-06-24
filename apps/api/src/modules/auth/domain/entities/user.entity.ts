export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT'

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface UserProps {
  id: string
  email: string
  passwordHash: string | null
  fullName: string
  role: UserRole
  status: UserStatus
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

  get id(): string { return this.props.id }
  get email(): string { return this.props.email }
  get passwordHash(): string | null { return this.props.passwordHash }
  get fullName(): string { return this.props.fullName }
  get role(): UserRole { return this.props.role }
  get status(): UserStatus { return this.props.status }
  get isActive(): boolean { return this.props.status === 'ACTIVE' }
  get lastLoginAt(): Date | null { return this.props.lastLoginAt ?? null }

  toPublicJson(): { id: string; email: string; fullName: string; role: UserRole } {
    return {
      id: this.props.id,
      email: this.props.email,
      fullName: this.props.fullName,
      role: this.props.role,
    }
  }
}

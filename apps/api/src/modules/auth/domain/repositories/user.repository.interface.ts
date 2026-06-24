import type { User, UserProps, UserRole, UserStatus } from '../entities/user.entity'

export interface CreateUserData {
  email: string
  passwordHash: string
  fullName: string
  role: UserRole
  legajo?: string | null
  phone?: string | null
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY')

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(data: CreateUserData): Promise<User>
  updatePasswordHash(id: string, hash: string): Promise<User>
  updateLastLogin(id: string, timestamp: Date): Promise<void>
  toUser(props: UserProps): User
  _typecheck?: { role: UserRole; status: UserStatus }
}

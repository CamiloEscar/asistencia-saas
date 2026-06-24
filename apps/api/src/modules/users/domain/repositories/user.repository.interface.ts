import type { User, UserProps, UserRole, UserStatus } from '../../../auth/domain/entities/user.entity'

export const USER_REPOSITORY = Symbol('USER_REPOSITORY')

export interface CreateUserInput {
  email: string
  passwordHash: string
  fullName: string
  role: UserRole
  legajo?: string | null
  phone?: string | null
  birthDate?: Date | null
  career?: string | null
}

export interface UpdateUserInput {
  fullName?: string
  email?: string
  role?: UserRole
  isActive?: boolean
  phone?: string | null
  legajo?: string | null
}

export interface ListUsersInput {
  cursor?: string | null
  limit?: number
  role?: UserRole | null
  isActive?: boolean | null
  search?: string | null
}

export interface ListUsersResult {
  data: User[]
  nextCursor: string | null
  hasMore: boolean
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>

  findByEmail(email: string): Promise<User | null>

  list(input: ListUsersInput): Promise<ListUsersResult>

  create(input: CreateUserInput): Promise<User>

  update(id: string, input: UpdateUserInput): Promise<User>

  setActive(id: string, isActive: boolean): Promise<User>

  setPasswordHash(id: string, passwordHash: string): Promise<User>

  countByRole(role: UserRole): Promise<number>

  toEntity(props: UserProps): User

  _typecheck?: { role: UserRole; status: UserStatus }
}

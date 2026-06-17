/**
 * Domain repository contract for users. All methods are
 * **tenant-scoped** — the implementation uses the
 * `forTenant(...)` transaction (or relies on the Prisma extension's
 * automatic `institutionId` injection) so no call ever crosses the
 * tenant boundary.
 *
 * Cross-tenant admin operations (super admin) use a different
 * repository in the institutions module; that one uses
 * `superAdminPrisma` and lives outside this module.
 */
import type { User, UserProps, UserRole, UserStatus } from '../../../auth/domain/entities/user.entity'

export const USER_REPOSITORY = Symbol('USER_REPOSITORY')

export interface CreateUserInput {
  email: string
  passwordHash: string
  fullName: string
  role: UserRole
  institutionId: string
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
  /** Look up by id within the caller's institution. */
  findByIdInInstitution(institutionId: string, id: string): Promise<User | null>

  /** Look up by email (case-insensitive) within the caller's institution. */
  findByEmailInInstitution(institutionId: string, email: string): Promise<User | null>

  /** Paginated list with optional filters. Always scoped to institutionId. */
  listInInstitution(institutionId: string, input: ListUsersInput): Promise<ListUsersResult>

  /** Create a user in the caller's institution. */
  createInInstitution(input: CreateUserInput): Promise<User>

  /** Partial update. Caller validates role-change semantics. */
  updateInInstitution(institutionId: string, id: string, input: UpdateUserInput): Promise<User>

  /** Toggle isActive. */
  setActiveInInstitution(institutionId: string, id: string, isActive: boolean): Promise<User>

  /** Update the password hash (used by the set-password flow). */
  setPasswordHashInInstitution(
    institutionId: string,
    id: string,
    passwordHash: string,
  ): Promise<User>

  /** Count users with a given role (used by dashboards + last-admin protection). */
  countByRoleInInstitution(institutionId: string, role: UserRole): Promise<number>

  /** Map a raw row → domain entity. Public to keep callers decoupled. */
  toEntity(props: UserProps): User

  _typecheck?: { role: UserRole; status: UserStatus }
}

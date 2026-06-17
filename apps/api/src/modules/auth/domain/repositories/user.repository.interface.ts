/**
 * Domain interface for user persistence. Use cases depend on this
 * abstraction; the Prisma implementation lives in `infrastructure/`.
 *
 * Note: `findByEmail(email, institutionId?)` uses the SUPER_ADMIN Prisma
 * client (no tenant filter) because at login time we don't yet know which
 * tenant the user belongs to — we look up across all tenants by email and
 * the subdomain we resolved. Cross-tenant lookup is safe here because
 * we're searching by a globally-unique email + matching against the
 * resolved institution id before any data is returned.
 */
import type { User, UserProps, UserRole, UserStatus } from '../entities/user.entity'

export interface CreateUserData {
  email: string
  passwordHash: string
  fullName: string
  role: UserRole
  institutionId: string
  legajo?: string | null
  phone?: string | null
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY')

export interface UserRepository {
  /**
   * Look up a user by email. If `institutionId` is provided, restricts the
   * search to that tenant (used after tenant resolution). If omitted, returns
   * the first user matching the email across all tenants (used for the
   * forgot-password flow which runs before tenant auth).
   *
   * Returns `null` if not found.
   */
  findByEmail(email: string, institutionId?: string | null): Promise<User | null>

  /** Look up by id, scoped to the current tenant context (forTenant). */
  findById(id: string): Promise<User | null>

  /**
   * Same as findById, but does NOT enforce the tenant filter. Used during
   * login AFTER the user has been authenticated (we know who they are;
   * the tenant guard will verify they belong to the resolved tenant).
   */
  findByIdForAuth(id: string): Promise<User | null>

  /** Create a user (admin provisioning, set-password completion). */
  create(data: CreateUserData): Promise<User>

  /** Update the user's password hash (set-password flow). */
  updatePasswordHash(id: string, hash: string): Promise<User>

  /** Mark the user as having logged in just now (for dashboards / audits). */
  updateLastLogin(id: string, timestamp: Date): Promise<void>

  /** Read shape used by `fromPersistence` — kept narrow so callers don't
   * depend on Prisma internals. */
  toUser(props: UserProps): User
  _typecheck?: { role: UserRole; status: UserStatus }
}

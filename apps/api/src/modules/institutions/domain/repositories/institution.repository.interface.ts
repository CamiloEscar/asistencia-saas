/**
 * Domain repository contract for institutions. Implementations are
 * super-admin-only (no tenant filter) because institutions are the
 * tenants — they are the only entity that exists outside the
 * `forTenant(...)` flow.
 *
 * The `IInstitutionRepository` interface lives in the domain layer;
 * the Prisma implementation in `infrastructure/persistence/` uses
 * `SUPER_ADMIN_PRISMA` (which bypasses the tenant filter extension).
 */
import type { Institution, InstitutionProps } from '../entities/institution.entity'

export const INSTITUTION_REPOSITORY = Symbol('INSTITUTION_REPOSITORY')

export interface CreateInstitutionInput {
  name: string
  subdomain: string
  plan?: string
  timezone?: string
  logoUrl?: string | null
}

export interface UpdateInstitutionInput {
  name?: string
  plan?: string
  timezone?: string
  logoUrl?: string | null
}

export interface ListInstitutionsInput {
  cursor?: string | null
  limit?: number
  isActive?: boolean | null
  search?: string | null
}

export interface ListInstitutionsResult {
  data: Institution[]
  nextCursor: string | null
  hasMore: boolean
}

export interface IInstitutionRepository {
  /** Look up by id (super-admin — no tenant filter). */
  findById(id: string): Promise<Institution | null>

  /** Look up by subdomain (super-admin — no tenant filter). */
  findBySubdomain(subdomain: string): Promise<Institution | null>

  /** Paginated list with optional filters. */
  list(input: ListInstitutionsInput): Promise<ListInstitutionsResult>

  /** Create a new institution. */
  create(input: CreateInstitutionInput): Promise<Institution>

  /** Partial update by id. Subdomain is immutable (caller enforces). */
  update(id: string, input: UpdateInstitutionInput): Promise<Institution>

  /** Soft-deactivate (set status = INACTIVE). */
  deactivate(id: string): Promise<Institution>

  /** Reactivate (set status = ACTIVE). */
  activate(id: string): Promise<Institution>

  /** Update only the logoUrl. */
  updateLogo(id: string, logoUrl: string | null): Promise<Institution>

  /** Map raw row → domain entity. Public to keep the
   * super-admin repositories consistent with the rest of the app. */
  toEntity(props: InstitutionProps): Institution
}

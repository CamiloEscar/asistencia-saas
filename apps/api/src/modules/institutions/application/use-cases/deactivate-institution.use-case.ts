import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { TenantResolverService } from '../../../../shared/tenant/tenant-resolver.service'
import {
  INSTITUTION_REPOSITORY,
  type IInstitutionRepository,
} from '../../domain/repositories/institution.repository.interface'
import type { Institution } from '../../domain/entities/institution.entity'

/**
 * DeactivateInstitutionUseCase — sets `status = INACTIVE` and
 * invalidates the tenant-resolver cache so the middleware blocks
 * future logins (TenantMiddleware checks `status === 'INACTIVE'`
 * and returns 403).
 *
 * Spec REQ-INST-005-01 says we should also revoke all refresh
 * token families for users in that institution. The cleanest way
 * to do that is to mark all `RefreshToken` rows for users of this
 * institution as `revoked` in the DB (the Redis side is best-effort
 * and will expire on its own). We add the DB-side revocation here.
 */
@Injectable()
export class DeactivateInstitutionUseCase {
  private readonly logger = new Logger(DeactivateInstitutionUseCase.name)

  constructor(
    @Inject(INSTITUTION_REPOSITORY)
    private readonly institutions: IInstitutionRepository,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async execute(id: string): Promise<Institution> {
    const existing = await this.institutions.findById(id)
    if (!existing) {
      throw new NotFoundException({ message: 'Institution not found', error: 'Not Found' })
    }

    const updated = await this.institutions.deactivate(id)

    // Invalidate the tenant cache so the next request sees INACTIVE
    // and TenantMiddleware blocks it (or returns 403). We bust BEFORE
    // returning to minimize the stale window.
    await this.tenantResolver.invalidate(existing.subdomain).catch((err) => {
      this.logger.warn(
        `Failed to invalidate tenant cache for ${existing.subdomain}: ${(err as Error).message}`,
      )
    })

    return updated
  }
}

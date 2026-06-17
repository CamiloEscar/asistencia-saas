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
 * ActivateInstitutionUseCase — sets `status = ACTIVE`. Users can
 * log in again after a full re-auth (no auto-resume of prior
 * sessions, per spec REQ-INST-006-01).
 */
@Injectable()
export class ActivateInstitutionUseCase {
  private readonly logger = new Logger(ActivateInstitutionUseCase.name)

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

    const updated = await this.institutions.activate(id)

    // Invalidate so subsequent requests pick up the new ACTIVE status.
    await this.tenantResolver.invalidate(existing.subdomain).catch((err) => {
      this.logger.warn(
        `Failed to invalidate tenant cache for ${existing.subdomain}: ${(err as Error).message}`,
      )
    })

    return updated
  }
}

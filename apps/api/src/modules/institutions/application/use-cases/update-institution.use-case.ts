import {
  BadRequestException,
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
import type { UpdateInstitutionDto } from '../dtos/update-institution.dto'

/**
 * UpdateInstitutionUseCase — partial update. Spec REQ-INST-004 says
 * `subdomain` is immutable; we enforce that here by simply not
 * accepting it in the DTO. If the tenant resolver cache needs to
 * be invalidated (because timezone or status changed), we bust it
 * so the next middleware read picks up the new value.
 */
@Injectable()
export class UpdateInstitutionUseCase {
  private readonly logger = new Logger(UpdateInstitutionUseCase.name)

  constructor(
    @Inject(INSTITUTION_REPOSITORY)
    private readonly institutions: IInstitutionRepository,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async execute(id: string, input: UpdateInstitutionDto): Promise<Institution> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException({ message: 'No fields to update' })
    }

    const existing = await this.institutions.findById(id)
    if (!existing) {
      throw new NotFoundException({ message: 'Institution not found', error: 'Not Found' })
    }

    const updated = await this.institutions.update(id, input)

    // Invalidate the tenant-resolver cache so subsequent requests see
    // the new timezone / status. The cache TTL is 60s, so without
    // this there would be a stale window.
    await this.tenantResolver.invalidate(existing.subdomain).catch((err) => {
      this.logger.warn(
        `Failed to invalidate tenant cache for ${existing.subdomain}: ${(err as Error).message}`,
      )
    })

    return updated
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  INSTITUTION_REPOSITORY,
  type IInstitutionRepository,
} from '../../domain/repositories/institution.repository.interface'
import type { Institution } from '../../domain/entities/institution.entity'

/**
 * GetInstitutionUseCase — fetch by id OR subdomain. The controller
 * exposes both `GET /:id` and `GET /by-slug/:slug`; this use case
 * normalizes the lookup to a single method.
 */
@Injectable()
export class GetInstitutionUseCase {
  constructor(
    @Inject(INSTITUTION_REPOSITORY)
    private readonly institutions: IInstitutionRepository,
  ) {}

  async byId(id: string): Promise<Institution> {
    const found = await this.institutions.findById(id)
    if (!found) {
      throw new NotFoundException({ message: 'Institution not found', error: 'Not Found' })
    }
    return found
  }

  async bySubdomain(subdomain: string): Promise<Institution> {
    const found = await this.institutions.findBySubdomain(subdomain)
    if (!found) {
      throw new NotFoundException({ message: 'Institution not found', error: 'Not Found' })
    }
    return found
  }
}

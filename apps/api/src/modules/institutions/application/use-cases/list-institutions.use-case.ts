import { Inject, Injectable } from '@nestjs/common'
import {
  INSTITUTION_REPOSITORY,
  type IInstitutionRepository,
  type ListInstitutionsResult,
} from '../../domain/repositories/institution.repository.interface'

/**
 * ListInstitutionsUseCase — paginated list of institutions with
 * optional status / search filters. Returns a cursor for the next
 * page (per cross-cutting REQ-X-002).
 */
@Injectable()
export class ListInstitutionsUseCase {
  constructor(
    @Inject(INSTITUTION_REPOSITORY)
    private readonly institutions: IInstitutionRepository,
  ) {}

  execute(input: {
    cursor?: string | null
    limit?: number
    isActive?: boolean | null
    search?: string | null
  }): Promise<ListInstitutionsResult> {
    return this.institutions.list({
      cursor: input.cursor ?? null,
      limit: input.limit ?? 20,
      isActive: input.isActive ?? null,
      search: input.search ?? null,
    })
  }
}

import { Inject, Injectable } from '@nestjs/common'
import {
  SUBJECT_REPOSITORY,
  type ISubjectRepository,
  type ListSubjectsResult,
} from '../../domain/repositories/subject.repository.interface'

/**
 * ListSubjectsUseCase — paginated list of subjects in the caller's
 * institution. Open to any authenticated user in the institution
 * (REQ-SUBJECT-001-01). Optional free-text search by code or name.
 */
@Injectable()
export class ListSubjectsUseCase {
  constructor(@Inject(SUBJECT_REPOSITORY) private readonly subjects: ISubjectRepository) {}

  execute(
    institutionId: string,
    input: { cursor?: string | null; limit?: number; search?: string | null },
  ): Promise<ListSubjectsResult> {
    return this.subjects.listInInstitution(institutionId, {
      cursor: input.cursor ?? null,
      limit: input.limit ?? 20,
      search: input.search ?? null,
    })
  }
}

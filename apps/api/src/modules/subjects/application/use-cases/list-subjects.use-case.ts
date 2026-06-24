import { Inject, Injectable } from '@nestjs/common'
import {
  SUBJECT_REPOSITORY,
  type ISubjectRepository,
  type ListSubjectsResult,
} from '../../domain/repositories/subject.repository.interface'

/**
 * ListSubjectsUseCase — paginated list of subjects. Open to any
 * authenticated user (REQ-SUBJECT-001-01). Optional free-text search
 * by code or name.
 */
@Injectable()
export class ListSubjectsUseCase {
  constructor(@Inject(SUBJECT_REPOSITORY) private readonly subjects: ISubjectRepository) {}

  execute(
    input: { cursor?: string | null; limit?: number; search?: string | null },
  ): Promise<ListSubjectsResult> {
    return this.subjects.list({
      cursor: input.cursor ?? null,
      limit: input.limit ?? 20,
      search: input.search ?? null,
    })
  }
}

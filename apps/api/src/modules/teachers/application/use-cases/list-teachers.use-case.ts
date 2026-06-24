import { Inject, Injectable } from '@nestjs/common'
import {
  TEACHER_REPOSITORY,
  type ITeacherRepository,
  type ListTeachersResult,
} from '../../domain/repositories/teacher.repository.interface'

/**
 * ListTeachersUseCase — paginated list of teachers in the caller's
 * institution, with optional active filter and free-text search.
 */
@Injectable()
export class ListTeachersUseCase {
  constructor(
    @Inject(TEACHER_REPOSITORY) private readonly teachers: ITeacherRepository,
  ) {}

  execute(input: {
    cursor?: string | null
    limit?: number
    isActive?: boolean | null
    search?: string | null
  }): Promise<ListTeachersResult> {
    return this.teachers.list({
      cursor: input.cursor ?? null,
      limit: input.limit ?? 20,
      isActive: input.isActive ?? null,
      search: input.search ?? null,
    })
  }
}

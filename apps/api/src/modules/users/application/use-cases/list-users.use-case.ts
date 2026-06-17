import { Inject, Injectable } from '@nestjs/common'
import {
  USER_REPOSITORY,
  type IUserRepository,
  type ListUsersResult,
} from '../../domain/repositories/user.repository.interface'

/**
 * ListUsersUseCase — paginated list of users in the caller's
 * institution, with optional role and active filters.
 */
@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
  ) {}

  execute(
    institutionId: string,
    input: {
      cursor?: string | null
      limit?: number
      role?: 'INSTITUTION_ADMIN' | 'TEACHER' | 'STUDENT' | null
      isActive?: boolean | null
      search?: string | null
    },
  ): Promise<ListUsersResult> {
    return this.users.listInInstitution(institutionId, {
      cursor: input.cursor ?? null,
      limit: input.limit ?? 20,
      role: input.role ?? null,
      isActive: input.isActive ?? null,
      search: input.search ?? null,
    })
  }
}

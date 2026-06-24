import { Inject, Injectable } from '@nestjs/common'
import {
  USER_REPOSITORY,
  type IUserRepository,
  type ListUsersResult,
} from '../../domain/repositories/user.repository.interface'

/**
 * ListUsersUseCase — paginated list of users with optional role and active filters.
 */
@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
  ) {}

  execute(input: {
    cursor?: string | null
    limit?: number
    role?: 'ADMIN' | 'TEACHER' | 'STUDENT' | null
    isActive?: boolean | null
    search?: string | null
  }): Promise<ListUsersResult> {
    return this.users.list({
      cursor: input.cursor ?? null,
      limit: input.limit ?? 20,
      role: input.role ?? null,
      isActive: input.isActive ?? null,
      search: input.search ?? null,
    })
  }
}

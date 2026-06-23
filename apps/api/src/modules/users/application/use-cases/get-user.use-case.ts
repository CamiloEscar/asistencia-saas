import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { User } from '../../../auth/domain/entities/user.entity'
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.interface'

/**
 * GetUserUseCase — fetch a single user by id, scoped to the caller's
 * institution. Returns 404 for cross-tenant lookups (REQ-USER-003-03).
 */
@Injectable()
export class GetUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}

  async execute(institutionId: string, id: string): Promise<User> {
    const found = await this.users.findByIdInInstitution(institutionId, id)
    if (!found) {
      throw new NotFoundException({ message: 'User not found', error: 'Not Found' })
    }
    return found
  }
}

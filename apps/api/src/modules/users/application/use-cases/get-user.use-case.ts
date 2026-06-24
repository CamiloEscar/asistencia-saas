import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { User } from '../../../auth/domain/entities/user.entity'
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.interface'

/**
 * GetUserUseCase — fetch a single user by id.
 */
@Injectable()
export class GetUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}

  async execute(id: string): Promise<User> {
    const found = await this.users.findById(id)
    if (!found) {
      throw new NotFoundException({ message: 'User not found', error: 'Not Found' })
    }
    return found
  }
}

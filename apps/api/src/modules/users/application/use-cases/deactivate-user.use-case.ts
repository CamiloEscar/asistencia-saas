import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.interface'
import type { User } from '../../../auth/domain/entities/user.entity'

/**
 * DeactivateUserUseCase — soft delete (sets isActive=false, deletedAt=now).
 * Historical records (attendance, enrollments) are preserved
 * automatically (no cascade). Refresh token revocation happens at
 * the controller level via the auth module's repository (defense in
 * depth — even if the controller forgets, the user can't log in
 * after `isActive = false`).
 */
@Injectable()
export class DeactivateUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}

  async execute(institutionId: string, targetUserId: string): Promise<User> {
    const target = await this.users.findByIdInInstitution(institutionId, targetUserId)
    if (!target) {
      throw new NotFoundException({ message: 'User not found', error: 'Not Found' })
    }

    // Last-admin protection also applies to deactivation.
    if (target.role === 'INSTITUTION_ADMIN') {
      const activeAdmins = await this.users.countByRoleInInstitution(
        institutionId,
        'INSTITUTION_ADMIN',
      )
      if (activeAdmins <= 1) {
        throw new ConflictException({
          message: 'Cannot deactivate the last institution admin',
          error: 'Conflict',
        })
      }
    }

    return this.users.setActiveInInstitution(institutionId, targetUserId, false)
  }
}

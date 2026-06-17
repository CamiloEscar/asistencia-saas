import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { User } from '../../../auth/domain/entities/user.entity'
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.interface'
import type { UpdateUserDto } from '../dtos/update-user.dto'

/**
 * UpdateUserUseCase — partial update with role-change constraints.
 *
 * Spec rules (REQ-USER-004):
 *   - Last-admin protection: if demoting the last active
 *     INSTITUTION_ADMIN, reject with 409.
 *   - Self-role-change denied (use `/auth/set-password` for
 *     self-service).
 *   - Role constrained to {INSTITUTION_ADMIN, TEACHER, STUDENT}
 *     (no SUPER_ADMIN — that's bootstrap-only).
 *
 * Email uniqueness is re-checked when the email is being changed
 * (409 if the new email is taken in the same institution).
 */
@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
  ) {}

  async execute(
    institutionId: string,
    actorUserId: string,
    targetUserId: string,
    input: UpdateUserDto,
  ): Promise<User> {
    const target = await this.users.findByIdInInstitution(institutionId, targetUserId)
    if (!target) {
      throw new NotFoundException({ message: 'User not found', error: 'Not Found' })
    }

    // Self-role-change is denied.
    if (input.role !== undefined && actorUserId === targetUserId) {
      throw new ForbiddenException({ message: 'Cannot change your own role' })
    }

    // Last-admin protection: if demoting an INSTITUTION_ADMIN, ensure
    // at least one other active admin remains in the institution.
    if (
      input.role !== undefined &&
      input.role !== 'INSTITUTION_ADMIN' &&
      target.role === 'INSTITUTION_ADMIN'
    ) {
      const activeAdmins = await this.users.countByRoleInInstitution(
        institutionId,
        'INSTITUTION_ADMIN',
      )
      if (activeAdmins <= 1) {
        throw new ConflictException({
          message: 'Cannot remove the last institution admin',
          error: 'Conflict',
        })
      }
    }

    // Email-uniqueness check when changing the email.
    if (input.email !== undefined && input.email.toLowerCase() !== target.email) {
      const conflict = await this.users.findByEmailInInstitution(
        institutionId,
        input.email,
      )
      if (conflict && conflict.id !== targetUserId) {
        throw new ConflictException({
          message: 'Email already in use in this institution',
          error: 'Conflict',
          field: 'email',
        })
      }
    }

    return this.users.updateInInstitution(institutionId, targetUserId, {
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      isActive: input.isActive,
      phone: input.phone,
      legajo: input.legajo,
    })
  }
}

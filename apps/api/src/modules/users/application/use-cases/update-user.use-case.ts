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
 *     ADMIN, reject with 409.
 *   - Self-role-change denied (use `/auth/set-password` for
 *     self-service).
 *   - Role constrained to {ADMIN, TEACHER, STUDENT}
 *     (no SUPER_ADMIN — that's bootstrap-only).
 *
 * Email uniqueness is re-checked when the email is being changed
 * (409 if the new email is taken).
 */
@Injectable()
export class UpdateUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}

  async execute(
    actorUserId: string,
    targetUserId: string,
    input: UpdateUserDto,
  ): Promise<User> {
    const target = await this.users.findById(targetUserId)
    if (!target) {
      throw new NotFoundException({ message: 'User not found', error: 'Not Found' })
    }

    // Self-role-change is denied.
    if (input.role !== undefined && actorUserId === targetUserId) {
      throw new ForbiddenException({ message: 'Cannot change your own role' })
    }

    // Last-admin protection: if demoting an ADMIN, ensure
    // at least one other active admin remains.
    if (
      input.role !== undefined &&
      input.role !== 'ADMIN' &&
      target.role === 'ADMIN'
    ) {
      const activeAdmins = await this.users.countByRole('ADMIN')
      if (activeAdmins <= 1) {
        throw new ConflictException({
          message: 'Cannot remove the last admin',
          error: 'Conflict',
        })
      }
    }

    // Email-uniqueness check when changing the email.
    if (input.email !== undefined && input.email.toLowerCase() !== target.email) {
      const conflict = await this.users.findByEmail(input.email)
      if (conflict && conflict.id !== targetUserId) {
        throw new ConflictException({
          message: 'Email already in use',
          error: 'Conflict',
          field: 'email',
        })
      }
    }

    return this.users.update(targetUserId, {
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      isActive: input.isActive,
      phone: input.phone,
      legajo: input.legajo,
    })
  }
}

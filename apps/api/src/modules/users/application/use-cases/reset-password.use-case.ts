import { randomBytes } from 'node:crypto'
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import  { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import  { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.interface'

/**
 * ResetPasswordUseCase — admin-initiated password reset.
 *
 * Spec REQ-USER-007:
 *   - Generates a new 16-char random password.
 *   - Hashes it (Argon2id) and updates the user.
 *   - Returns the new password in the response (no SMTP in MVP).
 *   - The auth module's controller is responsible for revoking all
 *     refresh token families for this user (we don't have direct
 *     access to the refresh-token repo from this use case).
 *   - Self-reset is rejected — use /auth/set-password for self-service.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly setPasswordUseCase: SetPasswordUseCase,
  ) {}

  async execute(
    actorUserId: string,
    targetUserId: string,
  ): Promise<{ temporaryPassword: string; setPasswordLink?: string }> {
    // Self-reset denied.
    if (actorUserId === targetUserId) {
      throw new BadRequestException({
        message: 'Use /auth/set-password for self-service',
        error: 'Bad Request',
      })
    }

    const target = await this.users.findById(targetUserId)
    if (!target) {
      throw new NotFoundException({ message: 'User not found', error: 'Not Found' })
    }

    const newPassword = this.generateTemporaryPassword()
    const newHash = await this.passwordHasher.hash(newPassword)
    await this.users.setPasswordHash(targetUserId, newHash)

    // Optionally issue a set-password signed link so the user can
    // pick their own password. Best-effort.
    let setPasswordLink: string | undefined
    try {
      const issued = await this.setPasswordUseCase.issue(targetUserId)
      setPasswordLink = issued.resetUrl
    } catch {
      // best-effort
    }

    return { temporaryPassword: newPassword, ...(setPasswordLink ? { setPasswordLink } : {}) }
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64url')
  }
}

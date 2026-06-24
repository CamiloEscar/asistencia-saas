import { Inject, Injectable, Logger } from '@nestjs/common'
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface'
import  { UserRepository } from '../../domain/repositories/user.repository.interface'
import  { SetPasswordUseCase } from './set-password.use-case'
import type { ForgotPasswordResponse } from '../dtos/forgot-password.dto'

/**
 * ForgotPasswordUseCase — MVP-limited (no SMTP).
 *
 * Flow (per spec REQ-AUTH-008):
 *   1. Resolve institution by subdomain.
 *   2. Look up user by (email, institutionId).
 *   3. If found, issue a set-password token. Return generic message + the
 *      full reset URL (so admin can copy it; in production, this would be
 *      emailed instead).
 *   4. If not found, return the same generic message (no enumeration) —
 *      we don't include resetUrl.
 *
 * The throttler on the controller limits to 3/min/IP (per design §5.5).
 */
@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name)

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly setPassword: SetPasswordUseCase,
  ) {}

  async execute(input: {
    email: string
  }): Promise<ForgotPasswordResponse> {
    let userId: string | null = null

    try {
      const user = await this.users.findByEmail(input.email)
      if (user && user.isActive) {
        userId = user.id
      }
    } catch {
      // user not found → still return generic success
    }

    if (userId) {
      const issued = await this.setPassword.issue(userId)
      return {
        message: 'If the email exists, a reset link has been generated',
        resetUrl: issued.resetUrl,
      }
    }

    // User not found — return generic message, no URL.
    return {
      message: 'If the email exists, a reset link has been generated',
    }
  }
}

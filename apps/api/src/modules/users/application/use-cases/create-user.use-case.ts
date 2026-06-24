import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import  { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import  { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'
import type { User } from '../../../auth/domain/entities/user.entity'
import { Email } from '../../../auth/domain/value-objects/email.vo'
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.interface'
import type { CreateUserDto, CreateUserResponse } from '../dtos/create-user.dto'

/**
 * CreateUserUseCase — creates a user.
 *
 * Constraints (per spec REQ-USER-002 + REQ-USER-004):
 *   - Email must be unique (409 if not).
 *   - Role must be in {ADMIN, TEACHER, STUDENT} (no
 *     SUPER_ADMIN from this path — that's bootstrap-only).
 *   - If no password is provided, generate a 16-char temporary
 *     password, hash it, and return it in the response (no SMTP
 *     in MVP — spec REQ-USER-002-02).
 *   - If `sendActivationLink: true`, also issue a set-password
 *     signed link via the auth module.
 */
@Injectable()
export class CreateUserUseCase {
  private readonly logger = new Logger(CreateUserUseCase.name)

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly setPasswordUseCase: SetPasswordUseCase,
  ) {}

  async execute(input: CreateUserDto): Promise<CreateUserResponse> {
    // 1. Validate the email format (also normalizes to lowercase).
    const email = Email.create(input.email)

    // 2. Enforce email uniqueness.
    const existing = await this.users.findByEmail(email.value)
    if (existing) {
      throw new ConflictException({
        message: 'Email already in use',
        error: 'Conflict',
        field: 'email',
      })
    }

    // 3. Generate a temporary password if none was provided.
    const plainPassword = input.password ?? this.generateTemporaryPassword()
    const passwordHash = await this.passwordHasher.hash(plainPassword)

    // 4. Create the user.
    const user: User = await this.users.create({
      email: email.value,
      passwordHash,
      fullName: input.fullName,
      role: input.role,
      legajo: input.legajo,
      phone: input.phone,
      birthDate: input.birthDate,
      career: input.career,
    })

    // 5. Build the response. The temporary password is only included
    // if we auto-generated it (i.e., the caller didn't provide one).
    const response: CreateUserResponse = {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: input.role,
        legajo: input.legajo,
        phone: input.phone,
      },
    }
    if (!input.password) {
      response.temporaryPassword = plainPassword
    }

    // 6. Optionally issue a set-password signed link.
    if (input.sendActivationLink) {
      try {
        const issued = await this.setPasswordUseCase.issue(user.id)
        response.setPasswordLink = issued.resetUrl
      } catch {
        // best-effort — the temporary password is enough to log in
      }
    }

    return response
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64url')
  }
}

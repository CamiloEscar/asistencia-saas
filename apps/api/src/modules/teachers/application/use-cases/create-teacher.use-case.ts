import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import  { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import  { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'
import type { Teacher } from '../../domain/entities/teacher.entity'
import { Email } from '../../../auth/domain/value-objects/email.vo'
import {
  TEACHER_REPOSITORY,
  type ITeacherRepository,
} from '../../domain/repositories/teacher.repository.interface'
import type { CreateTeacherDto } from '../../application/dtos/create-teacher.dto'

/**
 * CreateTeacherUseCase — thin wrapper over `users.create`
 * that forces `role = TEACHER` (REQ-TEACHER-002-02). The endpoint
 * is a convenience for the FE; admins could equally well call
 * `POST /api/users` with `role: TEACHER`.
 */
@Injectable()
export class CreateTeacherUseCase {
  private readonly logger = new Logger(CreateTeacherUseCase.name)

  constructor(
    @Inject(TEACHER_REPOSITORY) private readonly teachers: ITeacherRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly setPasswordUseCase: SetPasswordUseCase,
  ) {}

  async execute(input: CreateTeacherDto): Promise<{
    teacher: Teacher
    temporaryPassword?: string
    setPasswordLink?: string
  }> {
    const email = Email.create(input.email)

    const existing = await this.teachers.findByEmail(email.value)
    if (existing) {
      throw new ConflictException({
        message: 'Email already in use in this institution',
        error: 'Conflict',
        field: 'email',
      })
    }

    const plainPassword = input.password ?? this.generateTemporaryPassword()
    const passwordHash = await this.passwordHasher.hash(plainPassword)

    const teacher = await this.teachers.create({
      email: email.value,
      passwordHash,
      fullName: input.fullName,
      legajo: input.legajo,
      phone: input.phone,
    })

    const result: {
      teacher: Teacher
      temporaryPassword?: string
      setPasswordLink?: string
    } = { teacher }
    if (!input.password) {
      result.temporaryPassword = plainPassword
    }
    if (input.sendActivationLink) {
      try {
        const issued = await this.setPasswordUseCase.issue(teacher.id)
        result.setPasswordLink = issued.resetUrl
      } catch {
        // best-effort
      }
    }
    return result
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64url')
  }
}

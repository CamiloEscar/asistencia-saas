import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'
import { Email } from '../../../auth/domain/value-objects/email.vo'
import { Legajo } from '../../domain/value-objects/legajo.vo'
import type { Student } from '../../domain/entities/student.entity'
import {
  STUDENT_REPOSITORY,
  type IStudentRepository,
} from '../../domain/repositories/student.repository.interface'
import type { CreateStudentDto, CreateStudentResponse } from '../dtos/create-student.dto'

/**
 * CreateStudentUseCase — creates a student.
 *
 * Constraints (per spec REQ-STUDENT-002, REQ-STUDENT-006):
 *   - `legajo` validated (3-30 alphanumeric + hyphens, case-insensitive).
 *   - `email` validated + normalized to lowercase.
 *   - Legajo uniqueness (409 if not).
 *   - Email uniqueness (409 if not).
 *   - If no password is provided, generate a 16-char temporary
 *     password, hash it, and return it in the response (no SMTP
 *     in MVP). The student can later set their own via the
 *     set-password signed link.
 */
@Injectable()
export class CreateStudentUseCase {
  private readonly logger = new Logger(CreateStudentUseCase.name)

  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: IStudentRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly setPasswordUseCase: SetPasswordUseCase,
  ) {}

  async execute(input: CreateStudentDto): Promise<CreateStudentResponse> {
    // 1. Validate email and legajo formats.
    const email = input.email ? Email.create(input.email) : null
    const legajo = Legajo.create(input.legajo)

    // 2. Enforce legajo uniqueness.
    const existingByLegajo = await this.students.findByLegajo(legajo.value)
    if (existingByLegajo) {
      throw new ConflictException({
        message: 'Legajo already in use in this institution',
        error: 'Conflict',
        field: 'legajo',
      })
    }

    // 3. Enforce email uniqueness (when provided).
    if (email) {
      const existingByEmail = await this.students.findByEmail(email.value)
      if (existingByEmail) {
        throw new ConflictException({
          message: 'Email already in use in this institution',
          error: 'Conflict',
          field: 'email',
        })
      }
    }

    // 4. Generate a temporary password if none was provided.
    const plainPassword = input.password ?? this.generateTemporaryPassword()
    const passwordHash = await this.passwordHasher.hash(plainPassword)

    // 5. Create the student. If no email was provided, derive a
    // deterministic placeholder so the column's UNIQUE constraint
    // is satisfied. The student sets their real email at first
    // login via the set-password flow.
    const student: Student = await this.students.create({
      email: email?.value ?? `${legajo.value.toLowerCase()}@imported.local`,
      passwordHash,
      fullName: input.fullName,
      legajo: legajo.value,
      phone: input.phone,
      birthDate: input.birthDate,
      career: input.career,
    })

    // 6. Build the response. The temporary password is only included
    // if we auto-generated it.
    const response: CreateStudentResponse = {
      student: student.toPublicJson(),
    }
    if (!input.password) {
      response.temporaryPassword = plainPassword
    }

    // 7. Optionally issue a set-password signed link.
    if (input.sendActivationLink) {
      try {
        const issued = await this.setPasswordUseCase.issue(student.id)
        response.setPasswordLink = issued.resetUrl
      } catch {
        // best-effort
      }
    }

    return response
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64url')
  }
}

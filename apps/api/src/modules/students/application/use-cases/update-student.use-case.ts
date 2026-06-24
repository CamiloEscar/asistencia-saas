import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Email } from '../../../auth/domain/value-objects/email.vo'
import { Legajo } from '../../domain/value-objects/legajo.vo'
import type { Student } from '../../domain/entities/student.entity'
import {
  STUDENT_REPOSITORY,
  type IStudentRepository,
} from '../../domain/repositories/student.repository.interface'
import type { UpdateStudentDto } from '../dtos/update-student.dto'

/**
 * UpdateStudentUseCase — partial update for a student. Re-validates
 * legajo and email uniqueness when those fields are being changed
 * (REQ-STUDENT-003-02: 409 on duplicate legajo/email).
 *
 * Role is locked to `STUDENT` (no role change via this endpoint).
 */
@Injectable()
export class UpdateStudentUseCase {
  constructor(@Inject(STUDENT_REPOSITORY) private readonly students: IStudentRepository) {}

  async execute(id: string, input: UpdateStudentDto): Promise<Student> {
    const target = await this.students.findById(id)
    if (!target) {
      throw new NotFoundException({ message: 'Student not found', error: 'Not Found' })
    }

    // Re-validate legajo if changing.
    if (input.legajo !== undefined) {
      const legajo = Legajo.create(input.legajo)
      if (legajo.value !== target.legajo) {
        const conflict = await this.students.findByLegajo(legajo.value)
        if (conflict && conflict.id !== id) {
          throw new ConflictException({
            message: 'Legajo already in use in this institution',
            error: 'Conflict',
            field: 'legajo',
          })
        }
      }
      input.legajo = legajo.value
    }

    // Re-validate email if changing.
    if (input.email !== undefined && input.email !== target.email) {
      const email = Email.create(input.email)
      const conflict = await this.students.findByEmail(email.value)
      if (conflict && conflict.id !== id) {
        throw new ConflictException({
          message: 'Email already in use in this institution',
          error: 'Conflict',
          field: 'email',
        })
      }
      input.email = email.value
    }

    return this.students.update(id, {
      fullName: input.fullName,
      email: input.email,
      legajo: input.legajo,
      phone: input.phone,
      birthDate: input.birthDate,
      career: input.career,
    })
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Teacher } from '../../domain/entities/teacher.entity'
import {
  TEACHER_REPOSITORY,
  type ITeacherRepository,
} from '../../domain/repositories/teacher.repository.interface'
import type { UpdateTeacherDto } from '../../application/dtos/update-teacher.dto'

/**
 * UpdateTeacherUseCase — partial update for a teacher. Role is
 * locked to `TEACHER` (REQ-TEACHER-003). Email uniqueness is
 * re-checked when the email is being changed.
 */
@Injectable()
export class UpdateTeacherUseCase {
  constructor(@Inject(TEACHER_REPOSITORY) private readonly teachers: ITeacherRepository) {}

  async execute(id: string, input: UpdateTeacherDto): Promise<Teacher> {
    const target = await this.teachers.findById(id)
    if (!target) {
      throw new NotFoundException({ message: 'Teacher not found', error: 'Not Found' })
    }

    if (input.email !== undefined && input.email.toLowerCase() !== target.email) {
      const conflict = await this.teachers.findByEmail(input.email)
      if (conflict && conflict.id !== id) {
        throw new (await import('@nestjs/common')).ConflictException({
          message: 'Email already in use in this institution',
          error: 'Conflict',
          field: 'email',
        })
      }
    }

    return this.teachers.update(id, {
      fullName: input.fullName,
      email: input.email,
      isActive: input.isActive,
      phone: input.phone,
      legajo: input.legajo,
    })
  }
}

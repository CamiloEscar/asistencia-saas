import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Teacher } from '../../domain/entities/teacher.entity'
import {
  TEACHER_REPOSITORY,
  type ITeacherRepository,
} from '../../domain/repositories/teacher.repository.interface'

/**
 * DeactivateTeacherUseCase — soft delete (isActive=false).
 * Historical records preserved (course_teachers, attendance).
 */
@Injectable()
export class DeactivateTeacherUseCase {
  constructor(@Inject(TEACHER_REPOSITORY) private readonly teachers: ITeacherRepository) {}

  async execute(id: string): Promise<Teacher> {
    const target = await this.teachers.findById(id)
    if (!target) {
      throw new NotFoundException({ message: 'Teacher not found', error: 'Not Found' })
    }
    return this.teachers.setActive(id, false)
  }
}

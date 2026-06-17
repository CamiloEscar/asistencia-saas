import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Teacher } from '../../domain/entities/teacher.entity'
import {
  TEACHER_REPOSITORY,
  type ITeacherRepository,
} from '../../domain/repositories/teacher.repository.interface'

/**
 * GetTeacherUseCase — fetch by id, scoped to the caller's institution.
 * Returns 404 for cross-tenant lookups or wrong role.
 */
@Injectable()
export class GetTeacherUseCase {
  constructor(
    @Inject(TEACHER_REPOSITORY) private readonly teachers: ITeacherRepository,
  ) {}

  async execute(institutionId: string, id: string): Promise<Teacher> {
    const found = await this.teachers.findByIdInInstitution(institutionId, id)
    if (!found) {
      throw new NotFoundException({ message: 'Teacher not found', error: 'Not Found' })
    }
    return found
  }
}

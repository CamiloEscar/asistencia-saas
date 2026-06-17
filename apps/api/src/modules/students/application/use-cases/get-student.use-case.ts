import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Student } from '../../domain/entities/student.entity'
import {
  STUDENT_REPOSITORY,
  type IStudentRepository,
} from '../../domain/repositories/student.repository.interface'

/**
 * GetStudentUseCase — fetch a single student by id, scoped to the
 * caller's institution. Returns 404 for cross-tenant lookups or
 * wrong role (REQ-STUDENT-001).
 */
@Injectable()
export class GetStudentUseCase {
  constructor(@Inject(STUDENT_REPOSITORY) private readonly students: IStudentRepository) {}

  async execute(institutionId: string, id: string): Promise<Student> {
    const found = await this.students.findByIdInInstitution(institutionId, id)
    if (!found) {
      throw new NotFoundException({ message: 'Student not found', error: 'Not Found' })
    }
    return found
  }
}

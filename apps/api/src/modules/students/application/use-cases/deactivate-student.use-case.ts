import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Student } from '../../domain/entities/student.entity'
import {
  STUDENT_REPOSITORY,
  type IStudentRepository,
} from '../../domain/repositories/student.repository.interface'

/**
 * DeactivateStudentUseCase — soft delete (status = INACTIVE).
 * Historical records (enrollments, attendance) are preserved
 * (REQ-STUDENT-004-01).
 */
@Injectable()
export class DeactivateStudentUseCase {
  constructor(@Inject(STUDENT_REPOSITORY) private readonly students: IStudentRepository) {}

  async execute(institutionId: string, id: string): Promise<Student> {
    const target = await this.students.findByIdInInstitution(institutionId, id)
    if (!target) {
      throw new NotFoundException({ message: 'Student not found', error: 'Not Found' })
    }
    return this.students.setActiveInInstitution(institutionId, id, false)
  }
}

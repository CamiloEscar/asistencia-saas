import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Student } from '../../domain/entities/student.entity'
import {
  STUDENT_REPOSITORY,
  type IStudentRepository,
} from '../../domain/repositories/student.repository.interface'

/**
 * GetStudentUseCase — fetch a single student by id
 * (REQ-STUDENT-001).
 */
@Injectable()
export class GetStudentUseCase {
  constructor(@Inject(STUDENT_REPOSITORY) private readonly students: IStudentRepository) {}

  async execute(id: string): Promise<Student> {
    const found = await this.students.findById(id)
    if (!found) {
      throw new NotFoundException({ message: 'Student not found', error: 'Not Found' })
    }
    return found
  }
}

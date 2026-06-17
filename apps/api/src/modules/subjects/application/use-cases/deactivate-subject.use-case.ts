import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Subject } from '../../domain/entities/subject.entity'
import {
  SUBJECT_REPOSITORY,
  type ISubjectRepository,
} from '../../domain/repositories/subject.repository.interface'

/**
 * DeactivateSubjectUseCase — soft delete (sets deletedAt = now).
 * Per spec REQ-SUBJECT-004-02, subjects referenced by active
 * courses cannot be deleted (409 with a count of referencing
 * courses).
 */
@Injectable()
export class DeactivateSubjectUseCase {
  constructor(@Inject(SUBJECT_REPOSITORY) private readonly subjects: ISubjectRepository) {}

  async execute(institutionId: string, id: string): Promise<Subject> {
    const target = await this.subjects.findByIdInInstitution(institutionId, id)
    if (!target) {
      throw new NotFoundException({ message: 'Subject not found', error: 'Not Found' })
    }

    const activeCourseCount = await this.subjects.countActiveCoursesInInstitution(institutionId, id)
    if (activeCourseCount > 0) {
      throw new ConflictException({
        message: `Subject is in use by ${activeCourseCount} active courses`,
        error: 'Conflict',
      })
    }

    return this.subjects.setDeletedInInstitution(institutionId, id)
  }
}

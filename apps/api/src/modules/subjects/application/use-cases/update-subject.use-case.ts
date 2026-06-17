import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Subject } from '../../domain/entities/subject.entity'
import {
  SUBJECT_REPOSITORY,
  type ISubjectRepository,
} from '../../domain/repositories/subject.repository.interface'
import type { UpdateSubjectDto } from '../dtos/update-subject.dto'

/**
 * UpdateSubjectUseCase — partial update for a subject. Per spec
 * REQ-SUBJECT-003-02, the `code` is immutable (changing it would
 * break course references).
 */
@Injectable()
export class UpdateSubjectUseCase {
  constructor(@Inject(SUBJECT_REPOSITORY) private readonly subjects: ISubjectRepository) {}

  async execute(institutionId: string, id: string, input: UpdateSubjectDto): Promise<Subject> {
    const target = await this.subjects.findByIdInInstitution(institutionId, id)
    if (!target) {
      throw new NotFoundException({ message: 'Subject not found', error: 'Not Found' })
    }
    return this.subjects.updateInInstitution(institutionId, id, {
      name: input.name,
      description: input.description,
    })
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Subject } from '../../domain/entities/subject.entity'
import {
  SUBJECT_REPOSITORY,
  type ISubjectRepository,
} from '../../domain/repositories/subject.repository.interface'

/**
 * GetSubjectUseCase — fetch a single subject by id.
 */
@Injectable()
export class GetSubjectUseCase {
  constructor(@Inject(SUBJECT_REPOSITORY) private readonly subjects: ISubjectRepository) {}

  async execute(id: string): Promise<Subject> {
    const found = await this.subjects.findById(id)
    if (!found) {
      throw new NotFoundException({ message: 'Subject not found', error: 'Not Found' })
    }
    return found
  }
}

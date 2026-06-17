import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import {
  SUBJECT_REPOSITORY,
  type ISubjectRepository,
} from '../../domain/repositories/subject.repository.interface'
import type { CreateSubjectDto, CreateSubjectResponse } from '../dtos/create-subject.dto'

/**
 * CreateSubjectUseCase — creates a subject in the caller's
 * institution. Validates the code format (uppercase alphanumeric +
 * hyphens, 2-20 chars) and uniqueness within the institution
 * (REQ-SUBJECT-002-02).
 *
 * Codes are stored in their canonical (uppercase) form so the
 * case-insensitive uniqueness check at the DB layer (citext) is
 * belt-and-suspenders with the application-side check here.
 */
@Injectable()
export class CreateSubjectUseCase {
  private readonly logger = new Logger(CreateSubjectUseCase.name)

  constructor(@Inject(SUBJECT_REPOSITORY) private readonly subjects: ISubjectRepository) {}

  async execute(input: CreateSubjectDto, institutionId: string): Promise<CreateSubjectResponse> {
    const code = input.code.toUpperCase()

    const existing = await this.subjects.findByCodeInInstitution(institutionId, code)
    if (existing) {
      throw new ConflictException({
        message: 'Subject code already in use in this institution',
        error: 'Conflict',
        field: 'code',
      })
    }

    const subject = await this.subjects.createInInstitution({
      institutionId,
      code,
      name: input.name,
      description: input.description ?? null,
    })

    return { subject: subject.toPublicJson() }
  }
}

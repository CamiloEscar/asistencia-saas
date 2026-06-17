/**
 * Domain repository contract for subjects. Subjects are institution-
 * scoped; the implementation uses the Prisma extension's automatic
 * `institutionId` injection.
 *
 * Per spec REQ-SUBJECT-005, `code` is uppercase alphanumeric +
 * hyphens, 2-20 chars, case-insensitive uniqueness within the
 * institution.
 */
import type { Subject } from '../entities/subject.entity'

export const SUBJECT_REPOSITORY = Symbol('SUBJECT_REPOSITORY')

export interface CreateSubjectInput {
  institutionId: string
  code: string
  name: string
  description?: string | null
}

export interface UpdateSubjectInput {
  name?: string
  description?: string | null
}

export interface ListSubjectsInput {
  cursor?: string | null
  limit?: number
  search?: string | null
}

export interface ListSubjectsResult {
  data: Subject[]
  nextCursor: string | null
  hasMore: boolean
}

export interface ISubjectRepository {
  findByIdInInstitution(institutionId: string, id: string): Promise<Subject | null>
  findByCodeInInstitution(institutionId: string, code: string): Promise<Subject | null>
  listInInstitution(institutionId: string, input: ListSubjectsInput): Promise<ListSubjectsResult>
  createInInstitution(input: CreateSubjectInput): Promise<Subject>
  updateInInstitution(
    institutionId: string,
    id: string,
    input: UpdateSubjectInput,
  ): Promise<Subject>
  /** Soft delete (sets deletedAt). Caller must verify no active
   *  courses reference the subject (REQ-SUBJECT-004-02). */
  setDeletedInInstitution(institutionId: string, id: string): Promise<Subject>

  /** Count active courses referencing this subject. Used by the
   *  deactivate use case to enforce REQ-SUBJECT-004-02. */
  countActiveCoursesInInstitution(institutionId: string, id: string): Promise<number>
}

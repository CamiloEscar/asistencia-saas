/**
 * Domain repository contract for subjects.
 *
 * Per spec REQ-SUBJECT-005, `code` is uppercase alphanumeric +
 * hyphens, 2-20 chars, case-insensitive uniqueness.
 */
import type { Subject } from '../entities/subject.entity'

export const SUBJECT_REPOSITORY = Symbol('SUBJECT_REPOSITORY')

export interface CreateSubjectInput {
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
  findById(id: string): Promise<Subject | null>
  findByCode(code: string): Promise<Subject | null>
  list(input: ListSubjectsInput): Promise<ListSubjectsResult>
  create(input: CreateSubjectInput): Promise<Subject>
  update(id: string, input: UpdateSubjectInput): Promise<Subject>
  /** Soft delete (sets deletedAt). Caller must verify no active
   *  courses reference the subject (REQ-SUBJECT-004-02). */
  setDeleted(id: string): Promise<Subject>

  /** Count active courses referencing this subject. Used by the
   *  deactivate use case to enforce REQ-SUBJECT-004-02. */
  countActiveCourses(id: string): Promise<number>
}

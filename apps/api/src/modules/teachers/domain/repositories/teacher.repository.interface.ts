/**
 * Domain repository contract for teachers. Teachers are a
 * filtered view over `User` (`role = TEACHER` in the caller's
 * institution), so the implementation delegates to the user
 * repository and projects the `Teacher` shape.
 */
import type { Teacher } from '../entities/teacher.entity'

export const TEACHER_REPOSITORY = Symbol('TEACHER_REPOSITORY')

export interface CreateTeacherInput {
  email: string
  passwordHash: string
  fullName: string
  institutionId: string
  legajo?: string | null
  phone?: string | null
  userId?: string | null
}

export interface UpdateTeacherInput {
  fullName?: string
  email?: string
  isActive?: boolean
  phone?: string | null
  legajo?: string | null
}

export interface ListTeachersInput {
  cursor?: string | null
  limit?: number
  isActive?: boolean | null
  search?: string | null
}

export interface ListTeachersResult {
  data: Teacher[]
  nextCursor: string | null
  hasMore: boolean
}

export interface ITeacherRepository {
  findByIdInInstitution(institutionId: string, id: string): Promise<Teacher | null>
  findByEmailInInstitution(institutionId: string, email: string): Promise<Teacher | null>
  listInInstitution(institutionId: string, input: ListTeachersInput): Promise<ListTeachersResult>
  createInInstitution(input: CreateTeacherInput): Promise<Teacher>
  updateInInstitution(
    institutionId: string,
    id: string,
    input: UpdateTeacherInput,
  ): Promise<Teacher>
  setActiveInInstitution(institutionId: string, id: string, isActive: boolean): Promise<Teacher>
}

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
  findById(id: string): Promise<Teacher | null>
  findByEmail(email: string): Promise<Teacher | null>
  list(input: ListTeachersInput): Promise<ListTeachersResult>
  create(input: CreateTeacherInput): Promise<Teacher>
  update(id: string, input: UpdateTeacherInput): Promise<Teacher>
  setActive(id: string, isActive: boolean): Promise<Teacher>
}

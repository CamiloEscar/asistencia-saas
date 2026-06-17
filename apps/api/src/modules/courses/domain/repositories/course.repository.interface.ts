/**
 * Domain repository contract for courses. Courses are institution-
 * scoped. The implementation handles role-based filtering at the
 * read side (admin all, teacher assigned, student enrolled) and
 * m:n relationships via `Enrollment` and `CourseTeacher` (per the
 * design, the `Enrollment` table replaces what was historically
 * called `CourseStudent`).
 */
import type { Course } from '../entities/course.entity'

export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY')

export interface CreateCourseInput {
  institutionId: string
  subjectId: string
  code: string
  name: string
  description?: string | null
  semester: string
  startDate: Date
  endDate: Date
  schedule: unknown
  defaultSessionDurationMin?: number
}

export interface UpdateCourseInput {
  name?: string
  description?: string | null
  startDate?: Date
  endDate?: Date
  schedule?: unknown
  defaultSessionDurationMin?: number
}

export interface ListCoursesInput {
  cursor?: string | null
  limit?: number
  subjectId?: string | null
  teacherId?: string | null
  studentId?: string | null
  semester?: string | null
  search?: string | null
  isActive?: boolean | null
  /** When set, restricts the listing to the caller. */
  forRole?: 'ADMIN' | 'TEACHER' | 'STUDENT'
  /** Required when `forRole === 'TEACHER' | 'STUDENT'`. */
  forUserId?: string
}

export interface ListCoursesResult {
  data: Course[]
  nextCursor: string | null
  hasMore: boolean
}

export interface EnrolledStudent {
  id: string
  legajo: string | null
  fullName: string
  email: string
  isActive: boolean
}

export interface AssignedTeacher {
  id: string
  fullName: string
  email: string
  isActive: boolean
}

export interface ICourseRepository {
  findByIdInInstitution(institutionId: string, id: string): Promise<Course | null>
  findByCodeInInstitution(institutionId: string, code: string): Promise<Course | null>
  listInInstitution(institutionId: string, input: ListCoursesInput): Promise<ListCoursesResult>

  createInInstitution(input: CreateCourseInput): Promise<Course>
  updateInInstitution(institutionId: string, id: string, input: UpdateCourseInput): Promise<Course>
  setDeletedInInstitution(institutionId: string, id: string): Promise<Course>

  /** Enroll a student in a course. Idempotent (returns existing
   *  enrollment if already enrolled). */
  enrollStudent(courseId: string, studentId: string): Promise<void>
  /** Unenroll a student from a course. Idempotent (no-op if not
   *  enrolled). */
  unenrollStudent(courseId: string, studentId: string): Promise<void>
  /** List the students enrolled in a course, sorted by legajo ASC. */
  listEnrolledStudents(courseId: string): Promise<EnrolledStudent[]>
  isStudentEnrolled(courseId: string, studentId: string): Promise<boolean>

  /** Assign a teacher. Idempotent. */
  assignTeacher(courseId: string, teacherId: string): Promise<void>
  unassignTeacher(courseId: string, teacherId: string): Promise<void>
  listAssignedTeachers(courseId: string): Promise<AssignedTeacher[]>
  countAssignedTeachers(courseId: string): Promise<number>

  /** Check that the subject + teacher belong to the same
   *  institution. Throws 400 on mismatch. */
  validateSubjectInInstitution(institutionId: string, subjectId: string): Promise<void>
  validateTeacherInInstitution(institutionId: string, teacherId: string): Promise<void>
  validateStudentInInstitution(institutionId: string, studentId: string): Promise<void>
}

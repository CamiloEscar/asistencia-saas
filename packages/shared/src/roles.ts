/**
 * User roles for the entire system (FE + BE). Mirrors the Prisma enum
 * `UserRole` (apps/api/prisma/schema.prisma).
 *
 * RBAC: 4 roles total. SUPER_ADMIN is global; the other 3 are tenant-scoped.
 */
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  INSTITUTION_ADMIN: 'INSTITUTION_ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

/** All user roles as a tuple (for Zod enums). */
export const userRoleValues = [
  UserRole.SUPER_ADMIN,
  UserRole.INSTITUTION_ADMIN,
  UserRole.TEACHER,
  UserRole.STUDENT,
] as const

/** Human-readable Spanish labels for each role (used in UI). */
export const userRoleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Administrador',
  INSTITUTION_ADMIN: 'Administrador Institucional',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
}

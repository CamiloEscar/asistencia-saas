/**
 * User roles for the entire system (FE + BE). Mirrors the Prisma enum `UserRole`.
 *
 * Single-tenant edition: 3 roles (ADMIN, TEACHER, STUDENT).
 */
export const UserRole = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const userRoleValues = [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT] as const

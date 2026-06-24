/**
 * Barrel export for @asistencia/shared. Imported by both FE and BE.
 *
 * Conventions:
 *  - Enums (UserRole, AttendanceStatus, SessionStatus) are `as const` objects
 *    + matching types. Use the object for membership (e.g. `UserRole.ADMIN`),
 *    use the type for type positions.
 *  - DTOs are Zod schemas with an exported inferred type. Use the schema for
 *    runtime validation; use the type for type positions.
 */

export * from './roles'
export * from './attendance-status'

export * from './dtos/auth'
export * from './dtos/common'
export * from './dtos/user'
export * from './dtos/student'
export * from './dtos/teacher'
export * from './dtos/subject'
export * from './dtos/course'
export * from './dtos/attendance'

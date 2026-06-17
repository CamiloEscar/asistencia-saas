/**
 * Domain entity for a User. Mirrors the shape of `modules/auth/domain/
 * entities/user.entity.ts` so we don't introduce a second divergent
 * type. We re-export the role / status enums for consumers of the
 * users module that need to type guards.
 *
 * IMPORTANT: per design §6, the users module REUSES the auth
 * module's User entity. The auth module's `User` is the source of
 * truth for the user shape; here we just re-export the type so
 * use cases in this module can talk about a `User` without
 * importing from the auth module's `domain/entities/`.
 */
export {
  User,
  type UserProps,
  type UserRole,
  type UserStatus,
} from '../../../auth/domain/entities/user.entity'

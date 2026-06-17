import { SetMetadata } from '@nestjs/common'

export const ROLES_METADATA_KEY = 'auth:roles'

export type RoleName = 'SUPER_ADMIN' | 'INSTITUTION_ADMIN' | 'TEACHER' | 'STUDENT'

/**
 * `@Roles(Role.X, Role.Y)` — restricts a route to specific roles. Combined
 * with `RolesGuard` (registered globally in AppModule). If no `@Roles()`
 * is set, the route is open to any authenticated user.
 */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_METADATA_KEY, roles)

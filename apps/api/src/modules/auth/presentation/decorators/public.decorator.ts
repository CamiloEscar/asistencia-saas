import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'auth:isPublic'

/**
 * `@Public()` — marks a route as not requiring authentication. The
 * JwtAuthGuard (registered globally) checks for this metadata and skips
 * token validation if present.
 *
 * Use on: login, refresh, set-password (consume), forgot-password, jwks,
 * health, and any other unauthenticated endpoint.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true as const)

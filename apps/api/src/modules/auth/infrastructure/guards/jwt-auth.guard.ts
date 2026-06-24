import type { ExecutionContext } from '@nestjs/common'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { IS_PUBLIC_KEY } from '../../presentation/decorators/public.decorator'

/**
 * JwtAuthGuard — protects routes that require an authenticated user.
 *
 * - Routes can opt out via `@Public()` decorator (login, refresh,
 *   forgot-password, set-password consume, jwks, health).
 * - Validates the access token via the `jwt-access` Passport strategy.
 * - On success, populates `req.user` with the JWT claims (set by the
 *   strategy's `validate()`).
 * - On failure, throws 401 with a clear RFC 7807 body.
 *
 * Registered as the global APP_GUARD in AppModule (task 3.15).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    return super.canActivate(context)
  }

  override handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: unknown,
    _context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const reason =
        err?.message ??
        (info as { message?: string } | undefined)?.message ??
        'Authentication required'
      throw new UnauthorizedException({ message: reason })
    }
    return user
  }
}

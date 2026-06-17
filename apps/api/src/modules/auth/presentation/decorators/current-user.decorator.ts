import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'
import type { TokenClaims } from '../../../../shared/crypto/jwt.service'

/**
 * `@CurrentUser()` — extracts the JWT payload attached by JwtAuthGuard
 * (via the JwtAccessStrategy's `validate()`).
 *
 * Usage:
 *   @Get('me')
 *   me(@CurrentUser() user: TokenClaims) { ... }
 *
 * Returns the full payload (sub, role, institutionId, jti, etc.).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenClaims => {
    const req = ctx.switchToHttp().getRequest<{ user?: TokenClaims }>()
    if (!req.user) {
      throw new Error('CurrentUser called on an unauthenticated route')
    }
    return req.user
  },
)

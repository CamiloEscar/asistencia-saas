import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { CookieService } from '../cookies/cookie.service'
import { JwtKeysService } from '../../../../shared/crypto/jwt-keys.service'
import type { TokenClaims } from '../../../../shared/crypto/jwt.service'

/**
 * Passport strategy that validates RS256-signed ACCESS tokens from either
 * the `Authorization: Bearer <token>` header OR the `asistencia_access`
 * cookie. The cookie path is what the SPA uses; the header path supports
 * server-to-server calls and E2E tests.
 *
 * On success, populates `req.user` with the JWT claims. The JwtAuthGuard
 * (also in this module) attaches this to the request.
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    @Inject(JwtKeysService) private readonly keys: JwtKeysService,
    private readonly cookies: CookieService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: unknown): string | null => {
          const r = req as { cookies?: Record<string, string> } | undefined
          const value = r?.cookies?.[cookies.accessCookieName]
          return value ?? null
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: keys.getPublicKey(),
      algorithms: ['RS256'],
    })
  }

  validate(payload: TokenClaims): TokenClaims {
    // Access tokens MUST NOT have a `purpose` claim (refresh/activation do).
    if (payload.purpose) {
      throw new UnauthorizedException({
        message: 'Wrong token type',
      })
    }
    return payload
  }
}

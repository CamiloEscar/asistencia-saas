import { Controller, Get } from '@nestjs/common'
import type { JwtKeysService } from '../../../../shared/crypto/jwt-keys.service'
import { Public } from '../decorators/public.decorator'

/**
 * JWKS endpoint (`/.well-known/jwks.json`) — exposes the public key in
 * JWK format so external verifiers (future public API clients, mobile
 * apps) can verify our JWTs without sharing the secret (REQ-AUTH-010,
 * design §3.1).
 *
 * Public — no auth required.
 */
@Controller('.well-known')
export class JwksController {
  constructor(private readonly keys: JwtKeysService) {}

  @Public()
  @Get('jwks.json')
  getJwks(): { keys: Array<ReturnType<JwtKeysService['toJwk']>> } {
    return { keys: [this.keys.toJwk()] }
  }
}

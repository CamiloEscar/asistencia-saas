import { Inject, Injectable, Logger } from '@nestjs/common'
import { JwtService } from '../../../../shared/crypto/jwt.service'
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.interface'
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface'
import { ReuseDetectionService } from '../../infrastructure/services/reuse-detection.service'

export interface LogoutInput {
  userId: string
  /** Optional — if provided, only this family is revoked. If absent,
   * every active family for the user is revoked (logout from all devices). */
  refreshToken?: string
}

/**
 * LogoutUseCase — family revocation (per spec REQ-AUTH-006).
 *
 * Idempotent: calling without an authenticated session is a no-op
 * (returns success anyway so FE can call it safely on app boot).
 *
 * Flow:
 *   1. If refreshToken provided:
 *      a. Verify JWT (best-effort — already-revoked is OK).
 *      b. Extract familyId from claims.
 *      c. Revoke that family in DB + Redis.
 *   2. Else (no refreshToken): revoke ALL active families for the user.
 *   3. Return success.
 *
 * The cookie clear is the controller's responsibility (it owns the
 * Response object).
 */
@Injectable()
export class LogoutUseCase {
  private readonly logger = new Logger(LogoutUseCase.name)

  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    private readonly jwt: JwtService,
    private readonly reuse: ReuseDetectionService,
  ) {}

  async execute(input: LogoutInput): Promise<{ revokedFamilies: number }> {
    let familiesRevoked = 0

    if (input.refreshToken) {
      // Best-effort verify — even if the token is already invalid (TTL
      // expired, family revoked), the logout is still valid. We just
      // can't extract the family id from an unverifiable token.
      let familyId: string | null = null
      try {
        const claims = this.jwt.verifyRefreshToken(input.refreshToken)
        const c = claims as unknown as { familyId?: unknown }
        if (typeof c.familyId === 'string') familyId = c.familyId
      } catch {
        // Already invalid — best-effort path. Move on.
      }

      if (familyId) {
        await this.reuse.revokeFamily(input.userId, familyId)
        const count = await this.refreshTokens.markFamilyRevoked(familyId)
        familiesRevoked += count
      } else {
        // Couldn't verify — fall through to "revoke all" semantics so the
        // user definitely gets logged out.
        familiesRevoked += await this.revokeAllFamilies(input.userId)
      }
    } else {
      familiesRevoked = await this.revokeAllFamilies(input.userId)
    }

    this.logger.log(`Logout user=${input.userId} revokedFamilies=${familiesRevoked}`)
    return { revokedFamilies: familiesRevoked }
  }

  private async revokeAllFamilies(userId: string): Promise<number> {
    const families = await this.refreshTokens.findActiveFamiliesByUserId(userId)
    let total = 0
    for (const familyId of families) {
      await this.reuse.revokeFamily(userId, familyId)
      total += await this.refreshTokens.markFamilyRevoked(familyId)
    }
    return total
  }
}

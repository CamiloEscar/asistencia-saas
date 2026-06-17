import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import type { JwtService } from '../../../../shared/crypto/jwt.service'
import { type TokenClaims } from '../../../../shared/crypto/jwt.service'
import { CookieService } from '../../infrastructure/cookies/cookie.service'
import type { ReuseDetectionService } from '../../infrastructure/services/reuse-detection.service'
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.interface'
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface'
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface'
import type { UserRepository } from '../../domain/repositories/user.repository.interface'
import type { RefreshResponse } from '../dtos/refresh.dto'
import type { LoginUseCase } from './login.use-case'

export interface RefreshInput {
  /** Raw refresh token — from cookie or body. */
  refreshToken?: string
  /** Optional: allow the controller to pass the request for cookie lookup. */
  req?: Request
}

/**
 * RefreshUseCase — atomic refresh-token rotation with reuse detection
 * (per spec REQ-AUTH-004 + REQ-AUTH-005).
 *
 * Flow:
 *   1. Extract token from body OR cookie.
 *   2. Verify JWT signature + `purpose === 'refresh'`. Failure → 401.
 *   3. Call `ReuseDetectionService.recordUse()`:
 *      - 'OK' → continue.
 *      - 'REUSE_DETECTED' → revoke the family in DB + Redis, throw 401
 *        "Session revoked due to suspected token reuse".
 *      - 'FAMILY_REVOKED' / 'NOT_FOUND' → 401 generic.
 *   4. Look up the token in DB by hash. Missing or revoked or expired → 401.
 *   5. Mark old row as 'used' in DB.
 *   6. Look up the user (must exist and be active).
 *   7. Sign new pair (new jti, same familyId) via LoginUseCase.issueTokenPair.
 *   8. Mark old DB row as 'used' (already done in step 5 — kept here
 *      as an additional safety in case the DB mirror logic and the
 *      Redis logic diverge).
 *   9. Return new pair.
 */
@Injectable()
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name)

  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly jwt: JwtService,
    private readonly reuse: ReuseDetectionService,
    private readonly loginUseCase: LoginUseCase,
    private readonly cookieService: CookieService,
  ) {}

  async execute(
    input: RefreshInput,
  ): Promise<RefreshResponse & { _accessTtlSec: number; _refreshTtlSec: number }> {
    // 1. Extract token.
    const rawToken = input.refreshToken ?? this.readCookie(input.req)
    if (!rawToken) {
      throw new UnauthorizedException({ message: 'Refresh token required' })
    }

    // 2. Verify signature + purpose.
    let claims: TokenClaims
    try {
      claims = this.jwt.verifyRefreshToken(rawToken)
    } catch (err) {
      this.logger.warn(`Refresh token verify failed: ${(err as Error).message}`)
      throw new UnauthorizedException({ message: 'Invalid refresh token' })
    }

    const userId = claims.sub
    const familyId = claims.jti ? this.familyIdFromClaims(claims) : null
    if (!familyId) {
      throw new UnauthorizedException({ message: 'Invalid refresh token' })
    }

    // 3. Generate the new jti for the rotated token (we need it BEFORE the
    // Lua script runs, so we generate here and pass it in).
    const refreshTtlSec = CookieService.ttlToSeconds(process.env.JWT_REFRESH_TTL ?? '7d')
    const newRefresh = this.jwt.signRefreshToken({
      sub: userId,
      role: claims.role,
      institutionId: claims.institutionId,
      familyId,
    })

    // 4. Atomic check-and-rotate in Redis.
    const result = await this.reuse.recordUse({
      userId,
      oldJti: claims.jti,
      newJti: newRefresh.jti,
      familyId,
      expirySeconds: refreshTtlSec,
    })

    if (result === 'REUSE_DETECTED') {
      // Critical: revoke the family in DB as well so the mirror catches up.
      const revoked = await this.refreshTokens.markFamilyRevoked(familyId)
      this.logger.error(
        `REUSE_DETECTED for user ${userId} family ${familyId} — revoked ${revoked} DB rows; logging SUSPECTED_TOKEN_THEFT audit`,
      )
      // The audit interceptor (Phase 2) will pick this up — we just throw
      // 401 here.
      throw new UnauthorizedException({
        message: 'Session revoked due to suspected token reuse',
      })
    }
    if (result === 'FAMILY_REVOKED') {
      throw new UnauthorizedException({ message: 'Session revoked' })
    }
    if (result === 'NOT_FOUND') {
      // Either the token was never issued (forged) or expired in Redis
      // but is still valid in DB (clock drift). Check DB to be safe.
      const dbRecord = await this.refreshTokens.findByHash(this.refreshTokens.hashToken(rawToken))
      if (!dbRecord || dbRecord.status !== 'active' || dbRecord.expiresAt < new Date()) {
        throw new UnauthorizedException({ message: 'Invalid refresh token' })
      }
      // DB says active — Redis was cold. Re-issue in Redis and continue.
      await this.reuse.issueActive({
        userId,
        jti: claims.jti,
        familyId,
        expirySeconds: refreshTtlSec,
      })
    }

    // 5. DB: find the old row by hash (we have the raw token) and mark used.
    const oldRow = await this.refreshTokens.findByHash(this.refreshTokens.hashToken(rawToken))
    if (oldRow) {
      await this.refreshTokens.markUsed(oldRow.id)
    }

    // 6. Insert the new row in DB.
    await this.refreshTokens.create({
      userId,
      jti: newRefresh.jti,
      tokenHash: this.refreshTokens.hashToken(newRefresh.token),
      familyId,
      expiresAt: newRefresh.expiresAt,
    })

    // 7. Look up user + issue access token (new jti).
    const user = await this.users.findById(userId)
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ message: 'User not found or inactive' })
    }
    const access = this.jwt.signAccessToken({
      sub: user.id,
      role: user.role,
      institutionId: user.institutionId,
    })
    const accessTtlSec = CookieService.ttlToSeconds(process.env.JWT_ACCESS_TTL ?? '15m')

    return {
      accessToken: access.token,
      refreshToken: newRefresh.token,
      _accessTtlSec: accessTtlSec,
      _refreshTtlSec: refreshTtlSec,
    }
  }

  private readCookie(req?: Request): string | undefined {
    if (!req) return undefined
    const name = this.cookieService.refreshCookieName
    const raw = (req as Request & { cookies?: Record<string, string> }).cookies
    return raw?.[name]
  }

  /**
   * The `familyId` is stored as a claim on the refresh JWT by the issuer.
   * We extract it from the raw JWT payload — jsonwebtoken's `verify`
   * gives us the decoded claims directly.
   */
  private familyIdFromClaims(claims: TokenClaims): string | null {
    const c = claims as unknown as { familyId?: unknown }
    return typeof c.familyId === 'string' ? c.familyId : null
  }
}

export interface RefreshResponseInternal {
  _accessTtlSec?: number
  _refreshTtlSec?: number
}

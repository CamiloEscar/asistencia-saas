import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import  { JwtService } from '../../../../shared/crypto/jwt.service'
import { type TokenClaims } from '../../../../shared/crypto/jwt.service'
import { CookieService } from '../../infrastructure/cookies/cookie.service'
import  { ReuseDetectionService } from '../../infrastructure/services/reuse-detection.service'
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.interface'
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface'
import  { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface'
import  { UserRepository } from '../../domain/repositories/user.repository.interface'
import type { RefreshResponse } from '../dtos/refresh.dto'
import  { LoginUseCase } from './login.use-case'

export interface RefreshInput {
  refreshToken?: string
  req?: Request
}

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
    const rawToken = input.refreshToken ?? this.readCookie(input.req)
    if (!rawToken) {
      throw new UnauthorizedException({ message: 'Refresh token required' })
    }

    let claims: TokenClaims
    try {
      claims = this.jwt.verifyRefreshToken(rawToken)
    } catch (err) {
      this.logger.warn(`Refresh token verify failed: ${(err as Error).message}`)
      throw new UnauthorizedException({ message: 'Invalid refresh token' })
    }

    const userId = claims.sub
    const familyId = this.familyIdFromClaims(claims)
    if (!familyId) {
      throw new UnauthorizedException({ message: 'Invalid refresh token' })
    }

    const refreshTtlSec = CookieService.ttlToSeconds(process.env.JWT_REFRESH_TTL ?? '7d')
    const newRefresh = this.jwt.signRefreshToken({
      sub: userId,
      role: claims.role,
      familyId,
    })

    const result = await this.reuse.recordUse({
      userId,
      oldJti: claims.jti,
      newJti: newRefresh.jti,
      familyId,
      expirySeconds: refreshTtlSec,
    })

    if (result === 'REUSE_DETECTED') {
      const revoked = await this.refreshTokens.markFamilyRevoked(familyId)
      this.logger.error(
        `REUSE_DETECTED for user ${userId} family ${familyId} — revoked ${revoked} DB rows`,
      )
      throw new UnauthorizedException({ message: 'Session revoked due to suspected token reuse' })
    }
    if (result === 'FAMILY_REVOKED') {
      throw new UnauthorizedException({ message: 'Session revoked' })
    }
    if (result === 'NOT_FOUND') {
      const dbRecord = await this.refreshTokens.findByHash(this.refreshTokens.hashToken(rawToken))
      if (!dbRecord || dbRecord.status !== 'active' || dbRecord.expiresAt < new Date()) {
        throw new UnauthorizedException({ message: 'Invalid refresh token' })
      }
      await this.reuse.issueActive({ userId, jti: claims.jti, familyId, expirySeconds: refreshTtlSec })
    }

    const oldRow = await this.refreshTokens.findByHash(this.refreshTokens.hashToken(rawToken))
    if (oldRow) await this.refreshTokens.markUsed(oldRow.id)

    await this.refreshTokens.create({
      userId,
      jti: newRefresh.jti,
      tokenHash: this.refreshTokens.hashToken(newRefresh.token),
      familyId,
      expiresAt: newRefresh.expiresAt,
    })

    const user = await this.users.findById(userId)
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ message: 'User not found or inactive' })
    }
    const access = this.jwt.signAccessToken({ sub: user.id, role: user.role })
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

  private familyIdFromClaims(claims: TokenClaims): string | null {
    const c = claims as unknown as { familyId?: unknown }
    return typeof c.familyId === 'string' ? c.familyId : null
  }
}

export interface RefreshResponseInternal {
  _accessTtlSec?: number
  _refreshTtlSec?: number
}

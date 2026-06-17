import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import type { JwtService } from '../../../../shared/crypto/jwt.service'
import type { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import type { ResolvedTenant } from '../../../../shared/tenant/tenant-resolver.service'
import type { TenantResolverService } from '../../../../shared/tenant/tenant-resolver.service'
import type { User } from '../../domain/entities/user.entity'
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.interface'
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface'
import type { LoginResponse } from '../dtos/login.dto'
import { CookieService } from '../../infrastructure/cookies/cookie.service'
import type { ReuseDetectionService } from '../../infrastructure/services/reuse-detection.service'
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface'
import type { UserRepository } from '../../domain/repositories/user.repository.interface'
import { Inject } from '@nestjs/common'

export interface LoginInput {
  email: string
  password: string
  /** Resolved tenant from middleware — guaranteed present after TenantMiddleware. */
  tenant: ResolvedTenant
  ipAddress?: string
  userAgent?: string
}

/**
 * LoginUseCase — the single chokepoint for `/auth/login`.
 *
 * Flow (per spec REQ-AUTH-001 + REQ-AUTH-002 + REQ-AUTH-003):
 *   1. Tenant is already resolved by TenantMiddleware (input.tenant).
 *   2. Find user by (email, institutionId) using the SUPER_ADMIN Prisma
 *      client (no tenant filter extension) — we look up by email +
 *      matching tenant, so no cross-tenant leak.
 *   3. If not found, throw UnauthorizedException with the GENERIC
 *      message "Invalid credentials" (prevents user enumeration).
 *   4. If user has no passwordHash (set-password flow not completed yet),
 *      also throw 401 generic.
 *   5. Verify password with Argon2id. Bad password → generic 401.
 *   6. If user.status === INACTIVE → 401 generic (no info leak).
 *   7. Update lastLogin (best-effort).
 *   8. Sign access (15m) + refresh (7d) JWTs. New family_id.
 *   9. Persist refresh token (hash + familyId + expiresAt) in DB.
 *  10. Mark active in Redis (`refresh:{userId}:{jti}` HASH).
 *  11. Return { user, accessToken, refreshToken }.
 */
@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name)

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwt: JwtService,
    private readonly reuse: ReuseDetectionService,
    private readonly cookieService: CookieService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async execute(input: LoginInput): Promise<LoginResponse> {
    // Defense in depth: institution must be active. (TenantMiddleware
    // already rejects INACTIVE, but we re-check here in case the
    // middleware was bypassed in a future code path.)
    if (input.tenant.status !== 'ACTIVE') {
      throw new ForbiddenException({ message: 'Institution is inactive' })
    }

    // 1. Find user scoped to the resolved tenant.
    const user = await this.users.findByEmail(input.email, input.tenant.id)
    if (!user) {
      this.logger.warn(
        `Login failed: no user for ${input.email} in tenant ${input.tenant.subdomain}`,
      )
      throw new UnauthorizedException({ message: 'Invalid credentials' })
    }

    // 2. User must have completed the set-password flow.
    if (!user.passwordHash) {
      this.logger.warn(`Login failed: user ${user.id} has no password set`)
      throw new UnauthorizedException({ message: 'Invalid credentials' })
    }

    // 3. Verify password.
    const ok = await this.passwordHasher.verify(input.password, user.passwordHash)
    if (!ok) {
      this.logger.warn(`Login failed: bad password for ${input.email}`)
      throw new UnauthorizedException({ message: 'Invalid credentials' })
    }

    // 4. User status check.
    if (!user.isActive) {
      this.logger.warn(`Login failed: user ${user.id} is inactive`)
      throw new UnauthorizedException({ message: 'Invalid credentials' })
    }

    // 5. Last-login stamp (best-effort).
    await this.users.updateLastLogin(user.id, new Date())

    // 6. Issue token pair + persist refresh.
    return this.issueTokenPair({
      user,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
  }

  /**
   * Shared token-issuing path used by LoginUseCase AND SetPasswordConsumeUseCase.
   * Encapsulates the JWT signing + DB + Redis writes so both flows stay
   * consistent (same family/reuse-detection semantics).
   */
  async issueTokenPair(args: {
    user: User
    ipAddress?: string
    userAgent?: string
  }): Promise<LoginResponse> {
    const familyId = this.reuse.newFamilyId()
    const access = this.jwt.signAccessToken({
      sub: args.user.id,
      role: args.user.role,
      institutionId: args.user.institutionId,
    })
    const refresh = this.jwt.signRefreshToken({
      sub: args.user.id,
      role: args.user.role,
      institutionId: args.user.institutionId,
      familyId,
    })

    // TTLs for Redis (matching JWT exp) — we don't have direct access here,
    // so we hard-code: 15m access / 7d refresh are the spec values.
    const accessTtlSec = CookieService.ttlToSeconds(process.env.JWT_ACCESS_TTL ?? '15m')
    const refreshTtlSec = CookieService.ttlToSeconds(process.env.JWT_REFRESH_TTL ?? '7d')

    // DB mirror (durable).
    await this.refreshTokens.create({
      userId: args.user.id,
      jti: refresh.jti,
      tokenHash: this.refreshTokens.hashToken(refresh.token),
      familyId,
      expiresAt: refresh.expiresAt,
      userAgent: args.userAgent ?? null,
      ipAddress: args.ipAddress ?? null,
    })

    // Redis hot path.
    await this.reuse.issueActive({
      userId: args.user.id,
      jti: refresh.jti,
      familyId,
      expirySeconds: refreshTtlSec,
    })

    return {
      user: args.user.toPublicJson(),
      accessToken: access.token,
      refreshToken: refresh.token,
      _accessTtlSec: accessTtlSec,
      _refreshTtlSec: refreshTtlSec,
    } as unknown as LoginResponse
  }
}

// Internal field bag for cookie-setting. The controller reads these and
// strips them before sending the response body.
export interface LoginResponseInternal {
  _accessTtlSec?: number
  _refreshTtlSec?: number
}

// Re-export for typing convenience.
export type { LoginResponse }

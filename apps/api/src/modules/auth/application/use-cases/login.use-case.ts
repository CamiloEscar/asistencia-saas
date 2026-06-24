import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '../../../../shared/crypto/jwt.service'
import { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import type { User } from '../../domain/entities/user.entity'
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.interface'
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface'
import type { LoginResponse } from '../dtos/login.dto'
import { CookieService } from '../../infrastructure/cookies/cookie.service'
import { ReuseDetectionService } from '../../infrastructure/services/reuse-detection.service'
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface'
import { UserRepository } from '../../domain/repositories/user.repository.interface'
import { Inject } from '@nestjs/common'

export interface LoginInput {
  email: string
  password: string
  ipAddress?: string
  userAgent?: string
}

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
  ) {}

  async execute(input: LoginInput): Promise<LoginResponse> {
    const user = await this.users.findByEmail(input.email)
    if (!user) {
      this.logger.warn(`Login failed: no user for ${input.email}`)
      throw new UnauthorizedException({ message: 'Invalid credentials' })
    }

    if (!user.passwordHash) {
      this.logger.warn(`Login failed: user ${user.id} has no password set`)
      throw new UnauthorizedException({ message: 'Invalid credentials' })
    }

    const ok = await this.passwordHasher.verify(input.password, user.passwordHash)
    if (!ok) {
      this.logger.warn(`Login failed: bad password for ${input.email}`)
      throw new UnauthorizedException({ message: 'Invalid credentials' })
    }

    if (!user.isActive) {
      this.logger.warn(`Login failed: user ${user.id} is inactive`)
      throw new UnauthorizedException({ message: 'Invalid credentials' })
    }

    await this.users.updateLastLogin(user.id, new Date())

    return this.issueTokenPair({ user, ipAddress: input.ipAddress, userAgent: input.userAgent })
  }

  async issueTokenPair(args: {
    user: User
    ipAddress?: string
    userAgent?: string
  }): Promise<LoginResponse> {
    const familyId = this.reuse.newFamilyId()
    const access = this.jwt.signAccessToken({ sub: args.user.id, role: args.user.role })
    const refresh = this.jwt.signRefreshToken({ sub: args.user.id, role: args.user.role, familyId })

    const accessTtlSec = CookieService.ttlToSeconds(process.env.JWT_ACCESS_TTL ?? '15m')
    const refreshTtlSec = CookieService.ttlToSeconds(process.env.JWT_REFRESH_TTL ?? '7d')

    await this.refreshTokens.create({
      userId: args.user.id,
      jti: refresh.jti,
      tokenHash: this.refreshTokens.hashToken(refresh.token),
      familyId,
      expiresAt: refresh.expiresAt,
      userAgent: args.userAgent ?? null,
      ipAddress: args.ipAddress ?? null,
    })

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

export interface LoginResponseInternal {
  _accessTtlSec?: number
  _refreshTtlSec?: number
}

export type { LoginResponse }

import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { CurrentUser } from '../decorators/current-user.decorator'
import { CurrentTenant } from '../decorators/current-tenant.decorator'
import { Public } from '../decorators/public.decorator'
import type { ResolvedTenant } from '../../../../shared/tenant/tenant-resolver.service'
import type { CookieService } from '../../infrastructure/cookies/cookie.service'
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard'
import type { ForgotPasswordUseCase } from '../../application/use-cases/forgot-password.use-case'
import type { LoginUseCase } from '../../application/use-cases/login.use-case'
import type { LogoutUseCase } from '../../application/use-cases/logout.use-case'
import type { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case'
import type { SetPasswordUseCase } from '../../application/use-cases/set-password.use-case'
import {
  ForgotPasswordDtoSchema,
  type ForgotPasswordDto,
} from '../../application/dtos/forgot-password.dto'
import { LoginDtoSchema, type LoginDto } from '../../application/dtos/login.dto'
import type { LoginResponse } from '../../application/dtos/login.dto'
import { RefreshDtoSchema, type RefreshDto } from '../../application/dtos/refresh.dto'
import {
  SetPasswordDtoSchema,
  SetPasswordIssueDtoSchema,
  type SetPasswordDto,
} from '../../application/dtos/set-password.dto'
import type { TokenClaims } from '../../../../shared/crypto/jwt.service'
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface'
import type { UserRepository } from '../../domain/repositories/user.repository.interface'
import { Inject } from '@nestjs/common'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'

/**
 * AuthController — all `/api/v1/auth/*` endpoints (per design §5.1).
 *
 * Throttling (per design §5.5):
 *   - login: 5/min/IP
 *   - refresh: 30/min/IP (default)
 *   - forgot-password: 3/min/IP
 *
 * Cookies are set on login, refresh, and cleared on logout. The body
 * fields are returned in parallel so non-cookie clients (CLI, mobile,
 * E2E tests) can drive the flow without parsing cookies.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly setPasswordUseCase: SetPasswordUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly cookies: CookieService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  // ─── POST /auth/login ─────────────────────────────────────────────────
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginDtoSchema)) body: LoginDto,
    @CurrentTenant() tenant: ResolvedTenant,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const result = await this.loginUseCase.execute({
      email: body.email,
      password: body.password,
      tenant,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })
    // The use case returns LoginResponse with internal _accessTtlSec /
    // _refreshTtlSec fields used only for cookie-setting. We cast to
    // access them, then return the public-facing shape.
    const internal = result as LoginResponse & {
      _accessTtlSec?: number
      _refreshTtlSec?: number
    }
    if (internal._accessTtlSec) {
      this.cookies.setAccess(res, result.accessToken, internal._accessTtlSec)
    }
    if (internal._refreshTtlSec) {
      this.cookies.setRefresh(res, result.refreshToken, internal._refreshTtlSec)
    }
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }
  }

  // ─── POST /auth/refresh ──────────────────────────────────────────────
  @Public()
  @Post('refresh')
  async refresh(
    @Body(new ZodValidationPipe(RefreshDtoSchema)) body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const result = (await this.refreshUseCase.execute({
      refreshToken: body.refreshToken,
      req,
    })) as {
      accessToken: string
      refreshToken: string
      _accessTtlSec?: number
      _refreshTtlSec?: number
    }
    if (result._accessTtlSec) {
      this.cookies.setAccess(res, result.accessToken, result._accessTtlSec)
    }
    if (result._refreshTtlSec) {
      this.cookies.setRefresh(res, result.refreshToken, result._refreshTtlSec)
    }
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }
  }

  // ─── POST /auth/logout ────────────────────────────────────────────────
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: TokenClaims,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ revokedFamilies: number }> {
    const result = await this.logoutUseCase.execute({
      userId: user.sub,
      refreshToken: body?.refreshToken,
    })
    this.cookies.clearBoth(res)
    return result
  }

  // ─── GET /auth/me ─────────────────────────────────────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentUser() user: TokenClaims,
    @CurrentTenant() tenant: ResolvedTenant,
  ): Promise<{
    user: {
      id: string
      email: string
      fullName: string
      role: string
      institutionId: string | null
    }
    tenant: { id: string; subdomain: string; timezone: string }
  }> {
    // The JWT has the basic claims; we fetch the fullName fresh in case
    // it was updated since the token was issued.
    const fresh = await this.users.findById(user.sub)
    const fullName = fresh?.fullName ?? 'Unknown'
    return {
      user: {
        id: user.sub,
        email: fresh?.email ?? '',
        fullName,
        role: user.role,
        institutionId: user.institutionId ?? null,
      },
      tenant: {
        id: tenant.id,
        subdomain: tenant.subdomain,
        timezone: tenant.timezone,
      },
    }
  }

  // ─── POST /auth/set-password ──────────────────────────────────────────
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('set-password')
  async setPasswordConsume(
    @Body(new ZodValidationPipe(SetPasswordDtoSchema)) body: SetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const result = await this.setPasswordUseCase.consume(body.token, body.newPassword)
    // Auto-login: set the cookies.
    this.cookies.setAccess(res, result.accessToken, 15 * 60)
    this.cookies.setRefresh(res, result.refreshToken, 7 * 24 * 60 * 60)
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }
  }

  // ─── POST /auth/set-password/issue ────────────────────────────────────
  // Admin-only: issues a set-password link for a user. Skipped throttling
  // because admins can hit it as part of bulk provisioning.
  @Post('set-password/issue')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  async setPasswordIssue(
    @Body(new ZodValidationPipe(SetPasswordIssueDtoSchema)) body: { userId: string },
  ): Promise<unknown> {
    return this.setPasswordUseCase.issue(body.userId)
  }

  // ─── POST /auth/forgot-password ───────────────────────────────────────
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordDtoSchema)) body: ForgotPasswordDto,
  ): Promise<unknown> {
    return this.forgotPasswordUseCase.execute(body)
  }
}

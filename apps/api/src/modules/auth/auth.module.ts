import { Global, Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import Redis from 'ioredis'
import { CryptoModule } from '../../shared/crypto/crypto.module'
import { PrismaModule } from '../../shared/prisma/prisma.module'
import { TenantModule } from '../../shared/tenant/tenant.module'
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case'
import { LoginUseCase } from './application/use-cases/login.use-case'
import { LogoutUseCase } from './application/use-cases/logout.use-case'
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case'
import { SetPasswordUseCase } from './application/use-cases/set-password.use-case'
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository.interface'
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface'
import { CookieService } from './infrastructure/cookies/cookie.service'
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/prisma-refresh-token.repository'
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository'
import {
  ReuseDetectionService,
  REFRESH_REDIS_CLIENT,
} from './infrastructure/services/reuse-detection.service'
import { JwtAccessStrategy } from './infrastructure/strategies/jwt-access.strategy'
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard'
import { RolesGuard } from './infrastructure/guards/roles.guard'
import { TenantGuard } from './infrastructure/guards/tenant.guard'
import { SuperAdminOnlyGuard } from './infrastructure/guards/super-admin-only.guard'
import { AuthController } from './presentation/controllers/auth.controller'
import { JwksController } from './presentation/controllers/jwks.controller'

/**
 * AuthModule — wires the auth domain end-to-end.
 *
 * The DI tokens:
 *   - USER_REPOSITORY: tenant-aware lookup of users.
 *   - REFRESH_TOKEN_REPOSITORY: durable mirror of refresh token state.
 *
 * Redis connections:
 *   - DB 1: refresh tokens (REFRESH_REDIS_CLIENT).
 *   - DB 2: activation tokens (ACTIVATION_REDIS_CLIENT, used in set-password).
 *
 * The `JwtAccessStrategy` and guards are registered here for module-local
 * use; the JwtAuthGuard + RolesGuard + TenantGuard are also registered
 * globally in AppModule.
 */
@Global()
@Module({
  imports: [CryptoModule, PrismaModule, TenantModule, PassportModule],
  controllers: [AuthController, JwksController],
  providers: [
    // Repositories (DI tokens).
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },

    // Redis clients for auth (separate DBs from the main RedisService).
    {
      provide: REFRESH_REDIS_CLIENT,
      useFactory: () => {
        const db = Number(process.env.REDIS_REFRESH_DB ?? 1)
        const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
        return new Redis(url, { db, lazyConnect: true, maxRetriesPerRequest: 3 })
      },
    },
    {
      provide: 'ACTIVATION_REDIS_CLIENT',
      useFactory: () => {
        const db = Number(process.env.REDIS_ACTIVATION_DB ?? 2)
        const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
        return new Redis(url, { db, lazyConnect: true, maxRetriesPerRequest: 3 })
      },
    },

    // Services.
    CookieService,
    ReuseDetectionService,

    // Use cases.
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    SetPasswordUseCase,
    ForgotPasswordUseCase,

    // Passport strategy + guards.
    JwtAccessStrategy,
    JwtAuthGuard,
    RolesGuard,
    TenantGuard,
    SuperAdminOnlyGuard,
  ],
  exports: [
    USER_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    JwtAuthGuard,
    RolesGuard,
    TenantGuard,
    SuperAdminOnlyGuard,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    SetPasswordUseCase,
    ForgotPasswordUseCase,
    CookieService,
  ],
})
export class AuthModule {}

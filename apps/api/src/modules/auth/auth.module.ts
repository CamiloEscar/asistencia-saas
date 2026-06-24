import { Global, Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import Redis from 'ioredis'
import { CryptoModule } from '../../shared/crypto/crypto.module'
import { PrismaModule } from '../../shared/prisma/prisma.module'
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
import { AuthController } from './presentation/controllers/auth.controller'
import { JwksController } from './presentation/controllers/jwks.controller'

@Global()
@Module({
  imports: [CryptoModule, PrismaModule, PassportModule],
  controllers: [AuthController, JwksController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
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
    CookieService,
    ReuseDetectionService,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    SetPasswordUseCase,
    ForgotPasswordUseCase,
    JwtAccessStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    USER_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    JwtAuthGuard,
    RolesGuard,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    SetPasswordUseCase,
    ForgotPasswordUseCase,
    CookieService,
  ],
})
export class AuthModule {}

import type { MiddlewareConsumer, NestModule } from '@nestjs/common'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { TerminusModule } from '@nestjs/terminus'
import Redis from 'ioredis'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './modules/auth/auth.module'
import { InstitutionsModule } from './modules/institutions/institutions.module'
import { UsersModule } from './modules/users/users.module'
import { JwtAuthGuard } from './modules/auth/infrastructure/guards/jwt-auth.guard'
import { RolesGuard } from './modules/auth/infrastructure/guards/roles.guard'
import { TenantGuard } from './modules/auth/infrastructure/guards/tenant.guard'
import { HttpExceptionFilter } from './shared/filters/http-exception.filter'
import { ZodValidationPipe } from './shared/pipes/zod-validation.pipe'
import { envSchema } from './shared/config/env.schema'
import { PrismaModule } from './shared/prisma/prisma.module'
import { RedisModule } from './shared/redis/redis.module'
import { TenantMiddleware, TenantModule } from './shared/tenant/tenant.module'
import { AppLoggerModule } from './shared/logger/logger.module'
import { AuditModule } from './audit/audit.module'

/**
 * Root application module. Feature modules are registered in subsequent tasks
 * (auth, tenants, users, etc.) — this bootstrap wires the global cross-cutting
 * concerns: env validation, throttler, exception filter, validation pipe.
 *
 * Guard order (per design §3.5):
 *   1. TenantMiddleware (parses subdomain, sets ALS context, 400/403/404)
 *   2. JwtAuthGuard (global APP_GUARD; `@Public()` opt-out)
 *   3. RolesGuard (global APP_GUARD; `@Roles(...)` opt-in)
 *   4. TenantGuard (global APP_GUARD; JWT's institutionId must match ALS tenantId)
 *
 * ThrottlerGuard runs at the controller layer (also APP_GUARD). The order
 * between throttler and jwt is not specified by NestJS — what matters is
 * that all run before the controller handler. Throttler's default key
 * is the IP, so unauthenticated traffic gets rate-limited too.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => envSchema.parse(raw),
    }),
    PrismaModule,
    RedisModule,
    TenantModule,
    AppLoggerModule,
    AuditModule,
    AuthModule,
    InstitutionsModule,
    UsersModule,
    TerminusModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
        const client = new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 3,
        })
        return {
          throttlers: [
            {
              ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
              limit: Number(process.env.THROTTLE_LIMIT ?? 100),
            },
          ],
          storage: new ThrottlerStorageRedisService(client),
        }
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Auth guards — order matters: JwtAuth → Roles → Tenant.
    // (TenantGuard relies on req.user being populated, so JwtAuth must run first.)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule implements NestModule {
  /**
   * Wire the TenantMiddleware globally for /api/* routes. The middleware
   * MUST run before any guard (otherwise the guards can't read tenantId
   * from AsyncLocalStorage or req.tenant). It runs first because it's a
   * middleware, not a guard — NestJS resolves middleware → guards →
   * interceptors → pipes → controller.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('api/*', 'auth/*', '.well-known/*')
  }
}

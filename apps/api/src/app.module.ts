import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { ZodValidationPipe } from './shared/pipes/zod-validation.pipe';
import { envSchema } from './shared/config/env.schema';
import { PrismaModule } from './shared/prisma/prisma.module';
import { RedisModule } from './shared/redis/redis.module';
import { TenantModule } from './shared/tenant/tenant.module';
import { AppLoggerModule } from './shared/logger/logger.module';
import { AuditModule } from './audit/audit.module';

/**
 * Root application module. Feature modules are registered in subsequent tasks
 * (auth, tenants, users, etc.) — this bootstrap wires the global cross-cutting
 * concerns: env validation, throttler, exception filter, validation pipe.
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
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
        const client = new Redis(url, {
          // Lazy connect so a missing Redis at boot doesn't crash the API.
          lazyConnect: true,
          maxRetriesPerRequest: 3,
        });
        return {
          throttlers: [
            {
              ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
              limit: Number(process.env.THROTTLE_LIMIT ?? 100),
            },
          ],
          storage: new ThrottlerStorageRedisService(client),
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

import { Controller, Get } from '@nestjs/common';
import { HealthCheck, type HealthCheckResult, type HealthIndicatorResult } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './shared/prisma/prisma.service';
import { RedisService } from './shared/redis/redis.service';

/**
 * /health — public, un-throttled health check.
 *
 * Returns 200 with `{ status, info, error, details }` shape (Terminus
 * convention) when all dependencies are reachable. Returns 503 with the
 * same shape (and `error` populated) when any dependency is down.
 *
 * Docker healthcheck and uptime monitors (UptimeRobot, etc.) should poll
 * this endpoint.
 *
 * We do NOT use the standard `@nestjs/terminus` PrismaIndicator because it
 * requires a TypeORM DataSource. Instead we ping Prisma + Redis directly.
 */
@Controller('health')
@SkipThrottle()
export class AppController {
  private readonly startedAt = new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  async getHealth(): Promise<
    HealthCheckResult & { uptimeSeconds: number; service: string; env: string; version: string }
  > {
    const dbCheck = await this.checkDatabase();
    const redisCheck = await this.checkRedis();

    const allUp = dbCheck.status === 'up' && redisCheck.status === 'up';
    const result: HealthCheckResult = {
      status: allUp ? 'ok' : 'error',
      info: {
        database: dbCheck.status === 'up' ? dbCheck : undefined,
        redis: redisCheck.status === 'up' ? redisCheck : undefined,
      },
      error: {
        database: dbCheck.status !== 'up' ? dbCheck : undefined,
        redis: redisCheck.status !== 'up' ? redisCheck : undefined,
      },
      details: { database: dbCheck, redis: redisCheck },
    };
    return {
      ...result,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      service: 'asistencia-api',
      env: process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? '0.0.0',
    };
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', message: (err as Error).message, latencyMs: Date.now() - start };
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      const reply = await this.redis.ping();
      if (reply !== 'PONG') {
        return { status: 'down', message: `unexpected reply: ${reply}`, latencyMs: Date.now() - start };
      }
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', message: (err as Error).message, latencyMs: Date.now() - start };
    }
  }
}

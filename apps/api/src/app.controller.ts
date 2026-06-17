import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './shared/prisma/prisma.service';
import { RedisService } from './shared/redis/redis.service';

type HealthPayload = HealthCheckResult & {
  uptimeSeconds: number;
  service: string;
  env: string;
  version: string;
};

/**
 * /health — public, un-throttled health check.
 *
 * Uses @nestjs/terminus `HealthCheckService` with two custom indicator
 * functions (database + redis). Returns 200 with the standard Terminus
 * `{ status, info, error, details }` shape when all dependencies are
 * reachable, or 503 (also via Terminus' `HealthCheck()` decorator) when
 * any dependency is down. The extra fields (`uptimeSeconds`, `service`,
 * `env`, `version`) are merged in for ops convenience.
 *
 * Docker healthcheck and uptime monitors (UptimeRobot, etc.) should poll
 * this endpoint.
 *
 * We do NOT use the standard `@nestjs/terminus` `PrismaHealthIndicator`
 * because it expects a `PrismaClient` instance — we pass the Nest-managed
 * `PrismaService` directly. The custom indicators also report `latencyMs`
 * per check, which is useful for the dashboard.
 */
@Controller('health')
@SkipThrottle()
export class AppController {
  private readonly startedAt = new Date();
  private readonly dbIndicator = new PrismaDbHealthIndicator();
  private readonly redisIndicator = new RedisHealthIndicator();

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  async getHealth(): Promise<HealthPayload> {
    const result = await this.health.check([
      () => this.dbIndicator.check(this.prisma),
      () => this.redisIndicator.check(this.redis),
    ]);
    return {
      ...result,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      service: 'asistencia-api',
      env: process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? '0.0.0',
    };
  }
}

/**
 * Database health indicator — runs `SELECT 1` against Postgres and
 * reports `{ database: { status, latencyMs, message? } }`.
 */
class PrismaDbHealthIndicator extends HealthIndicator {
  async check(prisma: PrismaService): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return this.getStatus('database', true, { latencyMs: Date.now() - start });
    } catch (err) {
      return this.getStatus('database', false, {
        message: (err as Error).message,
        latencyMs: Date.now() - start,
      });
    }
  }
}

/**
 * Redis health indicator — issues a `PING` and reports
 * `{ redis: { status, latencyMs, message? } }`.
 */
class RedisHealthIndicator extends HealthIndicator {
  async check(redis: RedisService): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      const reply = await redis.ping();
      const isHealthy = reply === 'PONG';
      return this.getStatus('redis', isHealthy, {
        latencyMs: Date.now() - start,
        ...(isHealthy ? {} : { message: `unexpected reply: ${reply}` }),
      });
    } catch (err) {
      return this.getStatus('redis', false, {
        message: (err as Error).message,
        latencyMs: Date.now() - start,
      });
    }
  }
}

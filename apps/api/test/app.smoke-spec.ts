// Smoke test — boots the AppModule against a real Postgres + Redis (testcontainers)
// to assert that all the cross-cutting wiring (Prisma, Redis, Config, Logger,
// Throttler) composes without runtime errors. Per-feature tests live alongside
// the feature module (added in subsequent phases).

import { Test } from '@nestjs/testing';
import { startTestEnv, stopTestEnv, type TestEnv } from './testcontainers-env';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { RedisService } from '../src/shared/redis/redis.service';

describe('AppModule (smoke)', () => {
  let env: TestEnv;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    env = await startTestEnv();
  }, 120_000);

  afterAll(async () => {
    await stopTestEnv();
  }, 30_000);

  it('boots the AppModule and connects to Postgres + Redis', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    // Postgres round-trip
    const dbResult = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(dbResult[0]?.ok).toBe(1);

    // Redis round-trip
    const pong = await redis.ping();
    expect(pong).toBe('PONG');

    await app.close();
  }, 60_000);
});

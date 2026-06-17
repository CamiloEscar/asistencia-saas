// Shared testcontainers lifecycle. Import in any e2e spec that needs a real
// Postgres + Redis. Containers are started once per test file (Jest forks
// a worker per file), reused across `it` blocks, and shut down in afterAll.

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

let pg: StartedPostgreSqlContainer | undefined;
let redis: StartedTestContainer | undefined;
let migrated = false;

export interface TestEnv {
  databaseUrl: string;
  redisUrl: string;
}

export async function startTestEnv(): Promise<TestEnv> {
  if (!pg) {
    pg = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('asistencia_test')
      .withUsername('test')
      .withPassword('test')
      .start();
  }
  if (!redis) {
    redis = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
  }
  const databaseUrl = pg.getConnectionUri() + '?schema=public';
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;
  process.env.REDIS_REFRESH_DB = '1';
  process.env.REDIS_ACTIVATION_DB = '2';
  process.env.REDIS_BULLMQ_DB = '3';

  if (!migrated) {
    // Apply the RLS migration once. We use a subprocess of `prisma migrate
    // deploy` so we don't have to wire up the engine here. Skipped in CI
    // when the DB is already migrated.
    try {
      const { execSync } = await import('node:child_process');
      execSync('pnpm exec prisma migrate deploy --schema=../../prisma/schema.prisma', {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'inherit',
      });
      migrated = true;
    } catch (err) {
      // Don't crash the test run if migrate deploy fails — let the suite
      // surface the error.
      console.warn('migrate deploy failed:', (err as Error).message);
    }
  }

  return { databaseUrl, redisUrl };
}

export async function stopTestEnv(): Promise<void> {
  if (pg) {
    await pg.stop();
    pg = undefined;
  }
  if (redis) {
    await redis.stop();
    redis = undefined;
  }
  migrated = false;
}

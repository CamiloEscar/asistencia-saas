// Test environment setup. Loads test-time env vars BEFORE the Nest application
// module is imported. Tests that need real Postgres + Redis spin up
// testcontainers in their own beforeAll; this file only configures the env.

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
// DATABASE_URL / REDIS_URL are overridden per-suite by testcontainers.
// The defaults here are placeholders so `import { envSchema }` doesn't throw
// at config-module load time. Real suites replace them in beforeAll.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_TTL ??= '7d';
process.env.COOKIE_SAMESITE ??= 'lax';
process.env.COOKIE_SECURE ??= 'false';

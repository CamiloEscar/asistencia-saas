import { z } from 'zod';

/**
 * Zod schema for environment variables. Validated by `ConfigModule.validate`
 * (AppModule) at boot. Any missing or malformed env var causes a process exit
 * with a clear error message — fail-fast over silent defaults.
 */
export const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PREFIX: z.string().default('api/v1'),

  // CORS
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_URL_ADMIN: z.string().url().optional(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_REFRESH_DB: z.coerce.number().int().min(0).max(15).default(1),
  REDIS_ACTIVATION_DB: z.coerce.number().int().min(0).max(15).default(2),
  REDIS_BULLMQ_DB: z.coerce.number().int().min(0).max(15).default(3),

  // JWT
  JWT_PUBLIC_KEY: z.string().default(''),
  JWT_PRIVATE_KEY: z.string().default(''),
  JWT_PRIVATE_KEY_PATH: z.string().default('./secrets/jwt-private.pem'),
  JWT_PUBLIC_KEY_PATH: z.string().default('./secrets/jwt-public.pem'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_ACTIVATION_TTL: z.string().default('48h'),

  // Argon2id
  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(65536),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(3),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(4),

  // Cookies
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_ACCESS_NAME: z.string().default('asistencia_access'),
  COOKIE_REFRESH_NAME: z.string().default('asistencia_refresh'),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  CLOUDINARY_FOLDER: z.string().default('asistencia-saas'),

  // Multi-tenancy
  ROOT_DOMAIN: z.string().default('localhost'),

  // Throttler
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;

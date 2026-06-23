import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './shared/filters/http-exception.filter'
import { JwtKeysService } from './shared/crypto/jwt-keys.service'

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap')
  console.log('[BOOT] 1. Starting bootstrap...')

  // Initialize JWT keys BEFORE NestFactory.create() so the Passport
  // strategy constructor (which reads the public key) doesn't throw.
  const jwtKeys = new JwtKeysService(
    process.env.JWT_PRIVATE_KEY_PATH ?? './secrets/jwt-private.pem',
    process.env.JWT_PUBLIC_KEY_PATH ?? './secrets/jwt-public.pem',
  )
  jwtKeys.init()
  console.log('[BOOT] 2. JWT keys initialized')

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })
  console.log('[BOOT] 3. NestFactory created')

  // Behind a proxy (Nginx) — trust X-Forwarded-* headers.
  app.set('trust proxy', 1)

  // Security headers. Helmet defaults; CSP is permissive in dev and tightened in prod via env.
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  )

  // Cookies (signed) — required for refresh-token cookies.
  app.use(cookieParser())

  // CORS — dynamic origin check; FE on http://localhost:5173 in dev, *.app.com in prod.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      // Wildcard subdomains in dev (http://*.app.localhost) and prod (https://*.app.com).
      if (/^https?:\/\/[a-z0-9-]+\.app\.localhost(:\d+)?$/.test(origin)) {
        return callback(null, true)
      }
      if (/^https?:\/\/[a-z0-9-]+\.app\.com$/.test(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`CORS not allowed: ${origin}`), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-Subdomain',
      'X-Request-ID',
      'X-Confirm',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-API-Version'],
  })

  // Body size limit (covers bulk CSV upload up to 5MB).
  app.useBodyParser('json', { limit: '5mb' })
  app.useBodyParser('urlencoded', { limit: '5mb', extended: true })

  // Global validation pipe (class-validator). Zod schemas are validated in services
  // via the ZodValidationPipe (see shared/pipes). This catches the easy cases.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // Global exception filter (RFC 7807). The detailed ProblemJsonExceptionFilter
  // is added in task 2.6; this default catches everything to a 500 until then.
  app.useGlobalFilters(new HttpExceptionFilter())

  // Global prefix for all routes (e.g. /api/v1/health).
  const prefix = process.env.API_PREFIX ?? 'api/v1'
  app.setGlobalPrefix(prefix)

  const port = Number(process.env.PORT ?? 3000)
  console.log('[BOOT] 4. About to listen on port', port)
  await app.listen(port)
  console.log('[BOOT] 5. Listening')

  logger.log(`API listening on http://localhost:${port}/${prefix}`)
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`)
  logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`)
}

void bootstrap()

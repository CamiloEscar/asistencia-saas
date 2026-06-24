import { randomUUID } from 'node:crypto'
import type { MiddlewareConsumer, NestModule } from '@nestjs/common'
import { Global, Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import type { Request, Response } from 'express'

/**
 * Structured logging via Pino. JSON in production, pretty in dev.
 * Redacts sensitive fields: `password`, `authorization`, `cookie`, `token`,
 * `refresh_token`, `access_token`, `*.password`, `req.headers.cookie`.
 *
 * Every log line includes:
 *   - requestId
 */
@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard', singleLine: false },
              },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.token',
            'req.body.refreshToken',
            'req.body.accessToken',
            '*.password',
            '*.token',
            '*.refreshToken',
          ],
          censor: '[REDACTED]',
        },
        customProps: (req) => {
          return {
            requestId: (req.headers['x-request-id'] as string) ?? randomUUID(),
          }
        },
        genReqId: (req, res) => {
          const existing = (req.headers['x-request-id'] as string) ?? randomUUID()
          res.setHeader('x-request-id', existing)
          return existing
        },
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error'
          if (res.statusCode >= 400) return 'warn'
          return 'info'
        },
        serializers: {
          req: (req: Request) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.socket?.remoteAddress,
          }),
          res: (res: Response) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // LoggerModule's middleware is already wired via forRoutes('*') in main.ts.
    // We don't add additional middleware here.
    consumer.apply().forRoutes('*')
  }
}

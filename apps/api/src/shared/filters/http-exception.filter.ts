import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'

/**
 * Global exception filter that returns RFC 7807 Problem Details JSON.
 *
 * Replaces the default NestJS error response (plain `{ statusCode, message }`)
 * with the standardized shape:
 *   { type, title, status, detail, instance, errors? }
 *
 * The `type` is a URI identifying the error class; `instance` is the request path.
 * Validation errors include an `errors` array with field-level details from
 * class-validator / Zod. Unknown errors are logged with the full stack but the
 * client sees a generic 500 with no internals leaked.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    const requestId = (req.headers['x-request-id'] as string | undefined) ?? 'unknown'

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let title = 'Internal Server Error'
    let detail: string | undefined
    let type = 'https://asistencia-saas.com/errors/internal'
    let errors: Array<{ field?: string; message: string }> | undefined

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const payload = exception.getResponse()

      if (typeof payload === 'string') {
        detail = payload
      } else if (typeof payload === 'object' && payload !== null) {
        const obj = payload as Record<string, unknown>
        const message = obj.message
        const error = obj.error

        if (typeof message === 'string') {
          detail = message
        } else if (Array.isArray(message)) {
          errors = message.map((m) =>
            typeof m === 'string' ? { message: m } : (m as { field?: string; message: string }),
          )
          detail = 'Invalid request body'
        }
        if (typeof error === 'string') title = error
      }

      type = `https://asistencia-saas.com/errors/${statusTitleSlug(status)}`
      title = title || statusTitle(status)
    } else if (exception instanceof Error) {
      // Unknown error — log full stack with request id, return generic 500.
      this.logger.error(`[${requestId}] Unhandled exception: ${exception.message}`, exception.stack)
      detail = process.env.NODE_ENV === 'production' ? undefined : exception.message
    }

    const body = {
      type,
      title,
      status,
      detail,
      instance: req.originalUrl ?? req.url,
      ...(errors ? { errors } : {}),
    }

    // Strip undefined values for a cleaner payload.
    const cleanBody = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined))

    res.status(status).setHeader('Content-Type', 'application/problem+json').json(cleanBody)
  }
}

function statusTitle(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request'
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'Not Found'
    case 409:
      return 'Conflict'
    case 422:
      return 'Unprocessable Entity'
    case 429:
      return 'Too Many Requests'
    case 500:
      return 'Internal Server Error'
    case 503:
      return 'Service Unavailable'
    default:
      return status >= 500 ? 'Server Error' : 'Client Error'
  }
}

function statusTitleSlug(status: number): string {
  return statusTitle(status).toLowerCase().replace(/\s+/g, '-')
}

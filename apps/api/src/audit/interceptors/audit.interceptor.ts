import { Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { tap } from 'rxjs/operators';
import { SUPER_ADMIN_PRISMA } from '../shared/prisma/prisma.service';
import { getTenantContext } from '../shared/tenant/tenant.context';
import { AUDIT_METADATA_KEY, AuditMetadata } from './decorators/audit.decorator';

/**
 * AuditInterceptor — runs after every controller method that carries
 * `@Audit(...)` metadata. Captures: institution, actor, IP, userAgent,
 * requestId, action, entityType, entityId. Writes a row to `audit_log`.
 *
 * The write is fire-and-forget after the response is sent (so an audit
 * failure cannot break the user's request, per design §8.6).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(SUPER_ADMIN_PRISMA) private readonly prisma: PrismaClient,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const metadata = this.reflector.get<AuditMetadata | undefined>(AUDIT_METADATA_KEY, context.getHandler());
    if (!metadata) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request & { user?: { id: string; role: string } }>();
    const tenantCtx = getTenantContext();

    return next.handle().pipe(
      tap({
        next: (result: unknown) => {
          // Fire-and-forget. Don't block the response.
          void this.writeAudit(req, tenantCtx?.tenantId, req.user?.id, metadata, result).catch((err) => {
            this.logger.error(
              `Failed to write audit log for ${metadata.action}: ${(err as Error).message}`,
              (err as Error).stack,
            );
          });
        },
        error: (err: Error) => {
          // Still audit failed actions so we have a trail. The action stays
          // the same; we don't add FAILED_ prefix to keep the action taxonomy
          // stable. The HTTP status code in the request carries the failure signal.
          void this.writeAudit(req, tenantCtx?.tenantId, req.user?.id, metadata, null, err.message).catch((writeErr) => {
            this.logger.error(
              `Failed to write audit log for ${metadata.action}: ${(writeErr as Error).message}`,
              (writeErr as Error).stack,
            );
          });
        },
      }),
    );
  }

  private async writeAudit(
    req: Request & { params?: Record<string, string>; body?: Record<string, unknown> },
    institutionId: string | undefined,
    actorUserId: string | undefined,
    metadata: AuditMetadata,
    result: unknown,
    errorMessage?: string,
  ): Promise<void> {
    const entityId = this.resolveEntityId(req, metadata, result);

    await this.prisma.auditLog.create({
      data: {
        institutionId: institutionId ?? null,
        actorUserId: actorUserId ?? null,
        action: metadata.action,
        entityType: metadata.entityType,
        entityId: entityId ?? null,
        beforeJson: null, // set later when we add before/after diffing (Phase 8+)
        afterJson: result ? (result as object) : (errorMessage ? { error: errorMessage } : null),
        ipAddress: (req.ip as string) ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        requestId: (req.headers['x-request-id'] as string) ?? null,
      },
    });
  }

  private resolveEntityId(
    req: Request & { params?: Record<string, string>; body?: Record<string, unknown> },
    metadata: AuditMetadata,
    result: unknown,
  ): string | undefined {
    const source = metadata.entityIdFrom ?? 'param';
    switch (source) {
      case 'static':
        return metadata.entityIdStatic;
      case 'param': {
        const key = metadata.entityIdParam ?? 'id';
        return req.params?.[key];
      }
      case 'body': {
        const field = metadata.entityIdField ?? 'id';
        const body = req.body as Record<string, unknown> | undefined;
        const v = body?.[field];
        return typeof v === 'string' ? v : undefined;
      }
      case 'result': {
        const field = metadata.entityIdField ?? 'id';
        if (result && typeof result === 'object' && field in (result as Record<string, unknown>)) {
          const v = (result as Record<string, unknown>)[field];
          return typeof v === 'string' ? v : undefined;
        }
        return undefined;
      }
      default:
        return undefined;
    }
  }
}

import { Injectable, Logger, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithTenantContext } from './tenant.context';
import { TenantResolverService } from './tenant-resolver.service';

/**
 * TenantMiddleware — runs BEFORE every controller in /api/* and /auth/*.
 *
 * Flow:
 *   1. Extract the subdomain from `X-Tenant-Subdomain` header (FE injects
 *      from `window.location.hostname`).
 *   2. If absent, return 400 with a clear "subdomain required" error.
 *   3. Look up the institution via TenantResolverService (Redis-cached 60s).
 *   4. If status = INACTIVE, return 403.
 *   5. If not found, return 404.
 *   6. Otherwise, run the rest of the request inside `runWithTenantContext`,
 *      so the AsyncLocalStorage is populated for the Prisma extension and
 *      any downstream code that calls `getTenantContext()`.
 *
 * The middleware is the single chokepoint: a request that did NOT go
 * through here will fail at the Prisma layer with `TenantContextMissingError`.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly resolver: TenantResolverService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const rawSubdomain = (req.headers['x-tenant-subdomain'] as string | undefined)?.trim().toLowerCase();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? undefined;

    if (!rawSubdomain) {
      throw new UnauthorizedException({
        message: 'X-Tenant-Subdomain header is required',
        error: 'Unauthorized',
      });
    }

    let resolved;
    try {
      resolved = await this.resolver.resolveBySubdomain(rawSubdomain);
    } catch (err) {
      // NotFoundException passes through; bubble up everything else.
      throw err;
    }

    if (resolved.status === 'INACTIVE') {
      throw new UnauthorizedException({
        message: 'Institution is inactive',
        error: 'Unauthorized',
      });
    }

    // Stash on the request for handlers that want to read it directly.
    (req as Request & { tenant?: typeof resolved }).tenant = resolved;

    // Propagate the rest of the pipeline inside the AsyncLocalStorage scope.
    runWithTenantContext(
      {
        tenantId: resolved.id,
        subdomain: resolved.subdomain,
        timezone: resolved.timezone,
        requestId,
      },
      () => {
        next();
      },
    );
  }
}

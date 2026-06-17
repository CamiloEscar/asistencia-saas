import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Shape of the per-request tenant context. Populated by TenantMiddleware at
 * the beginning of every request, read by:
 *   - tenantAwareExtension (Prisma WHERE injection)
 *   - audit log writer (institutionId attribution)
 *   - Logging interceptor (institutionId, userId, role in every log line)
 *
 * The `subdomain` and `timezone` come from the cached institution record;
 * `userId` and `role` are populated after JwtAuthGuard runs (post-middleware).
 */
export interface TenantContextValue {
  /** UUID of the active institution. Never null in a populated context. */
  tenantId: string;
  /** Original subdomain (institution slug) for logging. */
  subdomain: string;
  /** IANA timezone from the institution record. Used by date helpers. */
  timezone: string;
  /** UUID of the authenticated user (populated by JwtAuthGuard). */
  userId?: string;
  /** Role of the authenticated user (populated by JwtAuthGuard). */
  role?: string;
  /** UUID of the current request, for cross-system correlation. */
  requestId?: string;
}

// Module-level storage shared between the NestJS-injectable service and the
// standalone function helpers. Both paths must read/write the same context
// so that code injected via DI and code that has no DI access (Prisma
// extensions, audit interceptor) see the same value.
const storage = new AsyncLocalStorage<TenantContextValue>();

/**
 * `TenantContextService` — NestJS-injectable wrapper around the module-level
 * `AsyncLocalStorage`. Use this in providers/controllers/guards that already
 * have a DI context. For code that doesn't (Prisma extensions, request
 * interceptors), use the standalone `getTenantContext()` / etc. helpers
 * exported below — they share the same storage.
 */
@Injectable()
export class TenantContextService {
  /**
   * Run `fn` inside a tenant context (creates a new async scope). Use this
   * for BullMQ worker jobs and other async work that has no parent context.
   */
  run<T>(ctx: TenantContextValue, fn: () => Promise<T> | T): Promise<T> | T {
    return storage.run(ctx, fn);
  }

  /**
   * Set the tenant context for the current async context WITHOUT creating a
   * new scope. Use this in HTTP middleware: the context propagates through
   * every subsequent `await` in the request pipeline (Node 16+ preserves
   * AsyncLocalStorage across microtasks automatically).
   */
  enter(ctx: TenantContextValue): void {
    storage.enterWith(ctx);
  }

  /** Read the current tenant context, or undefined if we're outside one. */
  get(): TenantContextValue | undefined {
    return storage.getStore();
  }

  /** Immutably merge a partial update into the active context. */
  patch(patch: Partial<TenantContextValue>): void {
    const current = storage.getStore();
    if (current) {
      Object.assign(current, patch);
    }
  }
}

// ─── Standalone function helpers ────────────────────────────────────────────
//
// These share the same module-level `AsyncLocalStorage` instance, so DI and
// non-DI callers always see the same context. Used by:
//   - tenantAwareExtension (Prisma extension, no DI)
//   - AuditInterceptor (no DI — receives from execution context)
//   - TenantMiddleware (no DI — NestJS middleware)
//   - PrismaService.getCurrentTenant() (could be DI, kept as a function for
//     ergonomics)
//
// Keep these signatures stable; they're part of the project's internal API.

export function runWithTenantContext<T>(
  ctx: TenantContextValue,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return storage.run(ctx, fn);
}

export function enterTenantContext(ctx: TenantContextValue): void {
  storage.enterWith(ctx);
}

export function getTenantContext(): TenantContextValue | undefined {
  return storage.getStore();
}

export function patchTenantContext(patch: Partial<TenantContextValue>): void {
  const current = storage.getStore();
  if (current) {
    Object.assign(current, patch);
  }
}

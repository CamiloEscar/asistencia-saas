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

const storage = new AsyncLocalStorage<TenantContextValue>();

/**
 * Run `fn` inside a tenant context. The context is automatically propagated
 * through every `await` and Promise chain. `TenantMiddleware` calls this
 * with the value resolved from the subdomain.
 *
 * Worker jobs (BullMQ) must call this at the top of their processor
 * (see design §2.2, R-Proposal-7).
 */
export function runWithTenantContext<T>(ctx: TenantContextValue, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(ctx, fn);
}

/** Read the current tenant context, or undefined if we're outside one. */
export function getTenantContext(): TenantContextValue | undefined {
  return storage.getStore();
}

/** Immutably merge a partial update into the active context. */
export function patchTenantContext(patch: Partial<TenantContextValue>): void {
  const current = storage.getStore();
  if (current) {
    Object.assign(current, patch);
  }
}

export const TenantContext = {
  run: runWithTenantContext,
  get: getTenantContext,
  patch: patchTenantContext,
};

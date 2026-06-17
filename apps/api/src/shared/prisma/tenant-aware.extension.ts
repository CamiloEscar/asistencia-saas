import { Prisma } from '@prisma/client';
import { getTenantContext } from '../tenant/tenant.context';

/**
 * Models that carry `institutionId` and therefore must be filtered by tenant.
 * Reference (denormalized) join tables are included so the GUC injection
 * covers the full tenant graph.
 */
export const TENANT_MODELS = new Set<string>([
  'User',
  'Subject',
  'Course',
  'CourseTeacher',
  'Enrollment',
  'ClassSession',
  'AttendanceRecord',
  'RefreshToken',
  'AuditLog',
]);

const READ_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

const WRITE_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

/**
 * `tenantAwareExtension` — Prisma client extension that injects
 * `institutionId` into the WHERE clause of every query against a
 * tenant-scoped model, using the value from AsyncLocalStorage.
 *
 * Reads the tenant from `TenantContext` (set by `TenantMiddleware`).
 * If no context is present, throws a `TenantContextMissingError` — this
 * is the chokepoint that prevents a controller from accidentally reading
 * cross-tenant data because the middleware was bypassed.
 *
 * NOTE on GUC: this extension only injects WHERE clauses. The Postgres GUC
 * (`app.current_institution_id`) is set inside explicit `$transaction`
 * blocks (see `PrismaService.forTenant`). The combination of WHERE injection
 * (application) + RLS policy (database) is the defense-in-depth described
 * in design §2.1.
 */
export const tenantAwareExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'tenantAware',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }

          const ctx = getTenantContext();
          if (!ctx) {
            throw new TenantContextMissingError(
              `No tenant context for ${model}.${operation}. All tenant-scoped queries must run inside TenantMiddleware.`,
            );
          }

          const a = (args ?? {}) as Record<string, unknown>;
          const tenantId = ctx.tenantId;

          if (READ_OPS.has(operation)) {
            args.where = mergeWhereWithInstitutionId(a.where, tenantId);
          } else if (operation === 'create') {
            args.data = mergeDataWithInstitutionId(a.data, tenantId);
          } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
            args.data = mergeCreateManyDataWithInstitutionId(a.data, tenantId);
          } else if (operation === 'upsert') {
            args.where = mergeWhereWithInstitutionId(a.where, tenantId);
            args.create = mergeDataWithInstitutionId(a.create, tenantId);
            args.update = a.update;
          } else if (WRITE_OPS.has(operation)) {
            args.where = mergeWhereWithInstitutionId(a.where, tenantId);
          }

          return query(args);
        },
      },
    },
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function mergeWhereWithInstitutionId(where: unknown, tenantId: string): Record<string, unknown> {
  const w = (where ?? {}) as Record<string, unknown>;
  // Preserve an explicit `institutionId: null` query (super-admin path) by
  // skipping the merge. The super-admin client does NOT use this extension,
  // so this branch is defensive only.
  if ('institutionId' in w && w.institutionId === null) return w;
  return { ...w, institutionId: tenantId };
}

function mergeDataWithInstitutionId(data: unknown, tenantId: string): Record<string, unknown> {
  const d = (data ?? {}) as Record<string, unknown>;
  return { ...d, institutionId: tenantId };
}

function mergeCreateManyDataWithInstitutionId(data: unknown, tenantId: string): Array<Record<string, unknown>> {
  if (!Array.isArray(data)) return [{ institutionId: tenantId }];
  return data.map((row) => ({ ...(row as Record<string, unknown>), institutionId: tenantId }));
}

// ─── Errors ──────────────────────────────────────────────────────────────

export class TenantContextMissingError extends Error {
  readonly status = 500;
  readonly code = 'TENANT_CONTEXT_MISSING';
  constructor(message: string) {
    super(message);
    this.name = 'TenantContextMissingError';
  }
}

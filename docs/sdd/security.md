# Multi-Tenant Defense-in-Depth — `asistencia-saas`

> ⚠️ **HISTORICAL** — this spec describes the multi-tenant defense-in-depth model
> that was REMOVED in the single-tenant refactor. Single-tenant deploys do not
> need this layer; tenant context, RLS policies, and subdomain routing were
> deleted. The active security model lives in [`apps/api/src/modules/app-config/`](../apps/api/src/modules/app-config/)
> and the auth-module RFC coverage. Keep this document for historical reference
> only — DO NOT reintroduce the layers described below.

> **Status (pre-refactor)**: LOCKED. This document was the canonical reference for the
> three-layer isolation model in `attendance-mvp` (Hito 1). Any code
> change that weakened any of these layers was a security incident.

## The threat

Cross-tenant data leakage. One institution's users, courses, attendance
records, or audit log entries accidentally visible to or writable by
another institution. This is a P0 incident class — students' attendance
data is PII, and a leak is reportable in LATAM jurisdictions.

The risk is amplified by the SaaS scale: a single API instance serves
every institution, every request is a chance for a bug to cross
boundaries, and the failure mode is silent (no exception, just wrong
data).

## The three layers

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: Application — Prisma tenant-aware extension        │
│  ──────────────────────────────────────────────────────────  │
│  Intercepts every Prisma call on a tenant-scoped model.      │
│  Injects institutionId into WHERE / data from AsyncLocal-    │
│  Storage (set by TenantMiddleware). Refuses cross-tenant     │
│  writes.                                                     │
│                                                              │
│  Failure mode if missing: WHERE clause absent → potentially  │
│  returns all tenants' rows. Mitigation: Layer 3 (RLS).       │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: Transport — AsyncLocalStorage + TenantMiddleware   │
│  ──────────────────────────────────────────────────────────  │
│  TenantMiddleware parses the X-Tenant-Subdomain header,      │
│  resolves the institution (Redis-cached 60s), and calls      │
│  enterWith() on the AsyncLocalStorage. Every subsequent      │
│  await in the request pipeline reads the same context.       │
│                                                              │
│  Failure mode if missing: tenant context unavailable →       │
│  Prisma extension throws TenantContextMissingError → 500.    │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: Database — PostgreSQL Row-Level Security           │
│  ──────────────────────────────────────────────────────────  │
│  Every tenant-scoped table has a USING clause that checks    │
│  institution_id = current_setting('app.current_institution_  │
│  id', true)::uuid. The GUC is set inside every Prisma        │
│  transaction via SET LOCAL.                                  │
│                                                              │
│  Failure mode if missing: an SQL injection or a misconfigured│
│  Prisma extension could leak rows across tenants. RLS is     │
│  the last line of defense, enforced at the engine level.     │
└──────────────────────────────────────────────────────────────┘
```

## How the layers cooperate on a single request

```
Browser
  │
  │ GET /api/v1/courses
  │ Cookie: asistencia_access=...
  │ Header: X-Tenant-Subdomain: celsius
  │
  ▼
Nginx (TLS + headers)
  │
  ▼
NestJS — TenantMiddleware
  │ 1. Parse X-Tenant-Subdomain = "celsius"
  │ 2. GET tenant:subdomain:celsius (Redis)
  │ 3. (on miss) SELECT ... FROM institutions WHERE subdomain=...
  │ 4. enterTenantContext({ tenantId, subdomain, timezone })
  │
  ▼
NestJS — JwtAuthGuard (global APP_GUARD)
  │ 5. Verify RS256 signature with public key
  │ 6. Attach req.user = { sub, role, institutionId, jti }
  │
  ▼
NestJS — RolesGuard (global APP_GUARD)
  │ 7. If @Roles() metadata set, check req.user.role ∈ metadata
  │
  ▼
NestJS — TenantGuard (global APP_GUARD)
  │ 8. If req.user.role !== SUPER_ADMIN, verify
  │    req.user.institutionId === ctx.tenantId (from ALS)
  │
  ▼
Controller — CoursesController
  │ 9. Inject PrismaService (the EXTENDED client)
  │
  ▼
Use case → prisma.course.findMany({ where: { ... } })
  │ 10. TenantAwareExtension intercepts $allOperations
  │ 11. Adds institutionId = ctx.tenantId to WHERE
  │
  ▼
PrismaService.forTenant(tenantId, async (tx) => { ... })  ← OR direct call
  │ 12. $transaction(...) opens a Postgres transaction
  │ 13. tx.$executeRawUnsafe(`SET LOCAL app.current_institution_id = '...'`)
  │ 14. The query runs against the tx
  │
  ▼
Postgres
  │ 15. RLS policy on courses:
  │     USING (institution_id = current_setting('app.current_institution_id', true)::uuid)
  │ 16. Index hit on (institution_id, code) — RLS filter is index-prefix-free
  │ 17. ONLY tenant A's courses are returned
  │
  ▼
Response → Browser
```

## What's the worst case if any ONE layer fails?

| Layer missing        | What breaks                                                                                         | What's still safe                                         |
| -------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Layer 1 (extension)  | Prisma queries might miss `institutionId` in WHERE → returns 0 rows (RLS denies) or full table scan | RLS still enforces; Layer 2+3 intact                      |
| Layer 2 (middleware) | AsyncLocalStorage is empty → Prisma extension throws 500                                            | Auth still rejects unauth; RLS still denies               |
| Layer 3 (RLS)        | SQL injection / misconfigured extension could leak rows                                             | App code still injects WHERE; ALS still propagates tenant |

The combination is what makes this safe: any ONE layer missing degrades
to "no data leaks, but the feature may not work" (not "silent leak").

## Defense-in-depth proofs (the security gate)

`apps/api/test/cross-tenant-isolation.e2e-spec.ts` (CI-gating) covers
the 6 scenarios that MUST pass for every PR:

1. **Login + JWT institutionId match.** Login as user in tenant A →
   JWT's `institutionId` claim equals tenant A's UUID.
2. **RLS blocks unfiltered query.** A raw SQL `SELECT * FROM users`
   (no `SET LOCAL`) returns 0 rows.
3. **RLS scopes by SET LOCAL.** With `SET LOCAL app.current_institution_id = A`,
   only A's users are returned; with B, only B's.
4. **Refresh-token replay rejected.** Replaying a used refresh token
   revokes the entire family and returns 401.
5. **Tampered JWT rejected.** A JWT signed with the legit key but
   with the wrong `institutionId` claim is rejected by `TenantGuard` (403).
6. **Super-admin path still subject to RLS.** `superAdminPrisma`
   bypasses the application-layer extension but RLS still denies rows
   when no `SET LOCAL` is issued on a tenant table.

If any of these fail in CI, the PR is blocked. This is the security
gate that prevents regressions.

## Common attack vectors and how we block them

| Attack                                                           | Layer that blocks           | How                                                                               |
| ---------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| Direct SQL injection in a controller                             | Layer 3 (RLS)               | The injection runs inside the tenant's transaction; RLS filters by institution_id |
| Prisma query without explicit WHERE                              | Layer 1 (extension)         | Extension injects institutionId automatically                                     |
| Cross-tenant token replay (user A's token used against tenant B) | Layer 2 (TenantGuard)       | Guards compare JWT's institutionId with ALS tenantId                              |
| Compromised refresh token                                        | Auth module reuse detection | Lua-atomic check + family revocation; second use triggers full family ban         |
| `/etc/hosts` / DNS spoofing of subdomain                         | Nginx + TLS                 | Cert pinned to wildcard; browser enforces                                         |
| Missing X-Tenant-Subdomain header                                | Layer 2 (TenantMiddleware)  | 400 with clear message — request never reaches controller                         |

## Operational notes

### Cache invalidation (Task 4.3)

`TenantResolverService.invalidate(subdomain)` deletes the
`tenant:subdomain:{sub}` key from Redis. Called by the institution
update/deactivate/reactivate use cases (Phase 5). Tests in
`apps/api/src/shared/tenant/test/tenant-resolver.spec.ts`.

### Why the cache TTL is 60s (not 0, not 5m)

- 60s: spec REQ-TENANT-002. Trades a 60s window for ACTIVE→INACTIVE
  consistency for a 60x DB load reduction on the hot path.
- 0: every request hits the DB; unnecessary cost on a multi-tenant
  SaaS where a single institution may have 1000+ concurrent users.
- 5m: too long — operators expect deactivate to take effect quickly
  for emergency shutdowns.

### Why we use `enterWith` (not `run`) in `enterTenantContext`

`run` creates a new async scope that exits when the callback returns —
fine for short tasks, broken for HTTP middleware (the context would be
gone by the time the controller handler runs). `enterWith` permanently
sets the context for the current async chain (Node 16+ preserves ALS
across microtasks/awaits). Critical fix landed in commit `2311b1c` —
without it, every controller call would 500.

## References

- **Design §2** (Multi-Tenant Architecture): the heart of the system
  (`sdd/attendance-mvp/design` #186 in engram)
- **Spec REQ-TENANT-001..010**: per-requirement behavior
  (`sdd/attendance-mvp/spec/tenant` #171 in engram)
- **Critical hotfix `2311b1c`**: enterWith vs run — read this if you're
  touching `tenant.context.ts`
- **E2E security gate**: `apps/api/test/cross-tenant-isolation.e2e-spec.ts`
- **Cache unit tests**: `apps/api/src/shared/tenant/test/tenant-resolver.spec.ts`

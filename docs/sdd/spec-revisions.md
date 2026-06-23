# SDD Spec Revisions

> Living log of revisions to spec artifacts after they were ratified by design.
> Each entry references the spec, the design decision that triggered it, and the
> engram observation IDs updated.

## Revision log

### 2026-06-16 — `chore(spec): align cookie SameSite policy to Lax per design Q3`

- **Triggered by**: design decision Q3 in engram `sdd/attendance-mvp/design` (#186, §0.1).
- **Why**: `SameSite=Strict` would break cross-port dev (`*.app.localhost:5173 → api.app.localhost:3000`) and cross-subdomain prod (`celsius.app.com → api.app.com`). `Lax` is the SaaS industry standard and is required for cross-subdomain navigation in production. Defense in depth is preserved by `HttpOnly` (XSS), CSP headers (design §8.2), and a double-submit CSRF token on state-changing requests (design §13 deferred).
- **Specs updated**:
  - `sdd/attendance-mvp/spec/auth` (#170) — REQ-AUTH-001 (login cookies), REQ-AUTH-006 (logout cookie clear) → `SameSite=Lax`. Scenarios SCE-AUTH-001-01 and SCE-AUTH-006-01 updated to reflect the new attribute set.
  - `sdd/attendance-mvp/spec/fe-auth` (#180) — FE-REQ-AUTH-004 (logout) and FE-REQ-AUTH-005 (axios interceptor) annotated with the Lax policy and a note on the deferred CSRF token.
- **Implementation impact**: tasks 3.5 (LoginUseCase) and 3.7 (LogoutUseCase) must use `SameSite=Lax` on cookie issuance/clearing. Task 12.8 (FE api-client) must use `credentials: 'include'`. No CORS, Nginx, or Prisma changes required.
- **sdd-apply task**: 0.1

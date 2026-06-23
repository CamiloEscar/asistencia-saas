import type { ExecutionContext } from '@nestjs/common'
import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TenantGuard } from './tenant.guard'
import { IS_PUBLIC_KEY } from '../../presentation/decorators/public.decorator'
import {
  runWithTenantContext,
  type TenantContextValue,
} from '../../../../shared/tenant/tenant.context'

/**
 * Unit test for TenantGuard — covers all branches including the
 * `@Public()` and unauthenticated-request short-circuits that prevent
 * spurious 403s on login / refresh / forgot-password / set-password.
 *
 * We do NOT mock `getTenantContext`: it reads from a module-level
 * AsyncLocalStorage that `enterTenantContext` populates, so driving the
 * storage directly is both simpler and exercises the real code path.
 */
type User = { institutionId?: string | null; role?: string }

function makeContext(user: User | undefined, isPublic: boolean): ExecutionContext {
  const handler = function noop() {}
  const cls = class Foo {}

  if (isPublic) {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler)
  }

  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext
}

describe('TenantGuard', () => {
  let guard: TenantGuard

  const tenantA: TenantContextValue = {
    tenantId: 'tenant-a-uuid',
    subdomain: 'celsius',
    timezone: 'UTC',
  }

  beforeEach(() => {
    guard = new TenantGuard(new Reflector())
  })

  it('skips entirely when the handler is marked @Public() (no ctx needed)', () => {
    const ctx = makeContext(undefined, true)

    expect(guard.canActivate(ctx)).toBe(true)
  })

  it("returns true defensively when there is no user (JwtAuthGuard already 401'd)", () => {
    const ctx = makeContext(undefined, false)

    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('allows SUPER_ADMIN regardless of institutionId', () => {
    const ctx = makeContext({ institutionId: null, role: 'SUPER_ADMIN' }, false)

    expect(runWithTenantContext(tenantA, () => guard.canActivate(ctx))).toBe(true)
  })

  it('allows when the JWT institutionId matches the tenant context', () => {
    const ctx = makeContext({ institutionId: 'tenant-a-uuid', role: 'TEACHER' }, false)

    expect(runWithTenantContext(tenantA, () => guard.canActivate(ctx))).toBe(true)
  })

  it('throws 403 with "Tenant mismatch" when institutionId differs from ctx', () => {
    const ctx = makeContext({ institutionId: 'tenant-b-uuid', role: 'TEACHER' }, false)

    const run = () => runWithTenantContext(tenantA, () => guard.canActivate(ctx))
    expect(run).toThrow(ForbiddenException)
    try {
      run()
    } catch (err) {
      const body = (err as ForbiddenException).getResponse() as { message: string }
      expect(body.message).toBe('Tenant mismatch')
    }
  })

  it('throws 403 with "Tenant context missing" when ctx is absent for an authenticated request', () => {
    const ctx = makeContext({ institutionId: 'tenant-a-uuid', role: 'TEACHER' }, false)

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
    try {
      guard.canActivate(ctx)
    } catch (err) {
      const body = (err as ForbiddenException).getResponse() as { message: string }
      expect(body.message).toBe('Tenant context missing')
    }
  })
})

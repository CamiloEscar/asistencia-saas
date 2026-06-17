import { Global, Module } from '@nestjs/common';
import { TenantContext } from './tenant.context';

/**
 * The TenantContext module is purely a service object (no DI providers needed);
 * AsyncLocalStorage is module-scoped. We still register a module so feature
 * code can `import { TenantContext } from '@shared/tenant/tenant.context'`
 * without coupling to the storage primitive.
 */
@Global()
@Module({
  providers: [],
  exports: [TenantContext],
})
export class TenantModule {}

export { TenantContext, runWithTenantContext, getTenantContext, patchTenantContext } from './tenant.context';

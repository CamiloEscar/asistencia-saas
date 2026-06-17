import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { TenantContextService } from './tenant.context';
import { TenantResolverService } from './tenant-resolver.service';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [TenantContextService, TenantResolverService],
  exports: [TenantContextService, TenantResolverService],
})
export class TenantModule {}

export {
  TenantContextService,
  runWithTenantContext,
  enterTenantContext,
  getTenantContext,
  patchTenantContext,
  type TenantContextValue,
} from './tenant.context';
export { TenantResolverService } from './tenant-resolver.service';
export { TenantMiddleware } from './tenant.middleware';

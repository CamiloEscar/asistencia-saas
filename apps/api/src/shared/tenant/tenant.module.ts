import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { TenantContext } from './tenant.context';
import { TenantResolverService } from './tenant-resolver.service';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [TenantResolverService],
  exports: [TenantContext, TenantResolverService],
})
export class TenantModule {}

export { TenantContext, runWithTenantContext, enterTenantContext, getTenantContext, patchTenantContext } from './tenant.context';
export { TenantResolverService } from './tenant-resolver.service';
export { TenantMiddleware } from './tenant.middleware';

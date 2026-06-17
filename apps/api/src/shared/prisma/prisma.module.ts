import { Global, Module } from '@nestjs/common';
import { PrismaService, SUPER_ADMIN_PRISMA, superAdminPrismaProvider } from './prisma.service';

/**
 * Global Prisma module. Exports `PrismaService` and the
 * `SUPER_ADMIN_PRISMA` token (super-admin path). Feature modules inject
 * `PrismaService` by default; only super-admin controllers/endpoints
 * inject `SUPER_ADMIN_PRISMA`.
 */
@Global()
@Module({
  providers: [PrismaService, superAdminPrismaProvider()],
  exports: [PrismaService, SUPER_ADMIN_PRISMA],
})
export class PrismaModule {}

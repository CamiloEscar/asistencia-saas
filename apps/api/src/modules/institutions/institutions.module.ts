import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CryptoModule } from '../../shared/crypto/crypto.module'
import { PrismaModule } from '../../shared/prisma/prisma.module'
import { TenantModule } from '../../shared/tenant/tenant.module'
import { CloudinaryModule } from '../../shared/cloudinary/cloudinary.module'
import { ActivateInstitutionUseCase } from './application/use-cases/activate-institution.use-case'
import { CreateInstitutionUseCase } from './application/use-cases/create-institution.use-case'
import { DeactivateInstitutionUseCase } from './application/use-cases/deactivate-institution.use-case'
import { GetInstitutionUseCase } from './application/use-cases/get-institution.use-case'
import { ListInstitutionsUseCase } from './application/use-cases/list-institutions.use-case'
import { UpdateInstitutionUseCase } from './application/use-cases/update-institution.use-case'
import { UploadLogoUseCase } from './application/use-cases/upload-logo.use-case'
import { INSTITUTION_REPOSITORY } from './domain/repositories/institution.repository.interface'
import { PrismaInstitutionRepository } from './infrastructure/persistence/prisma-institution.repository'
import { SuperAdminInstitutionsController } from './presentation/controllers/super-admin-institutions.controller'

/**
 * InstitutionsModule — super-admin-only CRUD for the tenant entities.
 *
 * The module imports `AuthModule` to get access to the
 * `SetPasswordUseCase` (used in the create flow to issue the initial
 * admin's set-password link). All other dependencies are local
 * (Prisma, Crypto, Tenant resolver, Cloudinary).
 */
@Module({
  imports: [PrismaModule, CryptoModule, TenantModule, CloudinaryModule, AuthModule],
  controllers: [SuperAdminInstitutionsController],
  providers: [
    { provide: INSTITUTION_REPOSITORY, useClass: PrismaInstitutionRepository },
    CreateInstitutionUseCase,
    ListInstitutionsUseCase,
    GetInstitutionUseCase,
    UpdateInstitutionUseCase,
    DeactivateInstitutionUseCase,
    ActivateInstitutionUseCase,
    UploadLogoUseCase,
  ],
  exports: [INSTITUTION_REPOSITORY],
})
export class InstitutionsModule {}

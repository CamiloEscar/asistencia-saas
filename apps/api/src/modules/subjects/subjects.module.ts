import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../../shared/prisma/prisma.module'
import { TenantModule } from '../../shared/tenant/tenant.module'
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard'
import { TenantGuard } from '../auth/infrastructure/guards/tenant.guard'
import { CreateSubjectUseCase } from './application/use-cases/create-subject.use-case'
import { ListSubjectsUseCase } from './application/use-cases/list-subjects.use-case'
import { GetSubjectUseCase } from './application/use-cases/get-subject.use-case'
import { UpdateSubjectUseCase } from './application/use-cases/update-subject.use-case'
import { DeactivateSubjectUseCase } from './application/use-cases/deactivate-subject.use-case'
import { SUBJECT_REPOSITORY } from './domain/repositories/subject.repository.interface'
import { PrismaSubjectRepository } from './infrastructure/persistence/prisma-subject.repository'
import { SubjectsController } from './presentation/controllers/subjects.controller'

/**
 * SubjectsModule — institution-scoped catalog of academic topics.
 * Cross-cutting dependencies are minimal: Prisma (for the DB) and
 * the auth module (for the guards).
 */
@Module({
  imports: [PrismaModule, TenantModule, AuthModule],
  controllers: [SubjectsController],
  providers: [
    { provide: SUBJECT_REPOSITORY, useClass: PrismaSubjectRepository },
    CreateSubjectUseCase,
    ListSubjectsUseCase,
    GetSubjectUseCase,
    UpdateSubjectUseCase,
    DeactivateSubjectUseCase,
    JwtAuthGuard,
    RolesGuard,
    TenantGuard,
  ],
  exports: [SUBJECT_REPOSITORY],
})
export class SubjectsModule {}

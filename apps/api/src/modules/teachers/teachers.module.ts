import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CryptoModule } from '../../shared/crypto/crypto.module'
import { PrismaModule } from '../../shared/prisma/prisma.module'
import { TenantModule } from '../../shared/tenant/tenant.module'
import { CoursesModule } from '../courses/courses.module'
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard'
import { TenantGuard } from '../auth/infrastructure/guards/tenant.guard'
import { CreateTeacherUseCase } from './application/use-cases/create-teacher.use-case'
import { ListTeachersUseCase } from './application/use-cases/list-teachers.use-case'
import { GetTeacherUseCase } from './application/use-cases/get-teacher.use-case'
import { UpdateTeacherUseCase } from './application/use-cases/update-teacher.use-case'
import { DeactivateTeacherUseCase } from './application/use-cases/deactivate-teacher.use-case'
import { TEACHER_REPOSITORY } from './domain/repositories/teacher.repository.interface'
import { PrismaTeacherRepository } from './infrastructure/persistence/prisma-teacher.repository'
import {
  MyCoursesController,
  TeachersController,
} from './presentation/controllers/teachers.controller'

/**
 * TeachersModule — `role = TEACHER` view over the User table.
 * Reuses the auth module's password-hashing + activation-link
 * machinery; doesn't own any new tables. The MyCoursesController
 * delegates to the courses module's MyCoursesUseCase so the
 * course-listing logic stays in one place.
 */
@Module({
  imports: [PrismaModule, CryptoModule, TenantModule, AuthModule, CoursesModule],
  controllers: [TeachersController, MyCoursesController],
  providers: [
    { provide: TEACHER_REPOSITORY, useClass: PrismaTeacherRepository },
    CreateTeacherUseCase,
    ListTeachersUseCase,
    GetTeacherUseCase,
    UpdateTeacherUseCase,
    DeactivateTeacherUseCase,
    JwtAuthGuard,
    RolesGuard,
    TenantGuard,
  ],
  exports: [TEACHER_REPOSITORY],
})
export class TeachersModule {}

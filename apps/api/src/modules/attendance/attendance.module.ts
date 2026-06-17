import { Module } from '@nestjs/common'
import { PrismaModule } from '../../shared/prisma/prisma.module'
import { TenantModule } from '../../shared/tenant/tenant.module'
import { AuthModule } from '../auth/auth.module'
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard'
import { TenantGuard } from '../auth/infrastructure/guards/tenant.guard'
import { ATTENDANCE_REPOSITORY } from './domain/repositories/attendance.repository.interface'
import { CLASS_SESSION_REPOSITORY } from './domain/repositories/class-session.repository.interface'
import { PrismaAttendanceRepository } from './infrastructure/persistence/prisma-attendance.repository'
import { PrismaClassSessionRepository } from './infrastructure/persistence/prisma-class-session.repository'
import { MarkAttendanceUseCase } from './application/use-cases/mark-attendance.use-case'
import { ModifyAttendanceUseCase } from './application/use-cases/modify-attendance.use-case'
import { ListAttendanceUseCase } from './application/use-cases/list-attendance.use-case'
import { AttendanceSummaryUseCase } from './application/use-cases/attendance-summary.use-case'
import { GetAttendanceUseCase } from './application/use-cases/get-attendance.use-case'
import { UploadEvidenceUseCase } from './application/use-cases/upload-evidence.use-case'
import { AttendanceController } from './presentation/controllers/attendance.controller'

/**
 * AttendanceModule — the heart of the MVP. Provides the bulk
 * attendance mark, single modify (with same-day rule), list,
 * and summary endpoints under `/api/attendance/*`.
 *
 * Tenant-scoped. The Prisma client auto-injects `institutionId`
 * via the tenant-aware extension. RLS is the final defense in
 * the DB.
 *
 * Internal dependency: also owns the `ClassSession` repository
 * because the attendance flow is the primary consumer (it
 * get-or-creates sessions lazily on first mark). Other modules
 * (e.g. courses) can read sessions via their own queries.
 */
@Module({
  imports: [PrismaModule, TenantModule, AuthModule],
  controllers: [AttendanceController],
  providers: [
    { provide: ATTENDANCE_REPOSITORY, useClass: PrismaAttendanceRepository },
    { provide: CLASS_SESSION_REPOSITORY, useClass: PrismaClassSessionRepository },
    MarkAttendanceUseCase,
    ModifyAttendanceUseCase,
    ListAttendanceUseCase,
    AttendanceSummaryUseCase,
    GetAttendanceUseCase,
    UploadEvidenceUseCase,
    JwtAuthGuard,
    RolesGuard,
    TenantGuard,
  ],
  exports: [ATTENDANCE_REPOSITORY, CLASS_SESSION_REPOSITORY],
})
export class AttendanceModule {}

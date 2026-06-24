import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CsvModule } from '../../shared/csv/csv.module'
import { CryptoModule } from '../../shared/crypto/crypto.module'
import { PrismaModule } from '../../shared/prisma/prisma.module'
import { QueueModule } from '../../shared/queue/queue.module'
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard'
import { CreateStudentUseCase } from './application/use-cases/create-student.use-case'
import { ListStudentsUseCase } from './application/use-cases/list-students.use-case'
import { GetStudentUseCase } from './application/use-cases/get-student.use-case'
import { UpdateStudentUseCase } from './application/use-cases/update-student.use-case'
import { DeactivateStudentUseCase } from './application/use-cases/deactivate-student.use-case'
import { BulkImportStudentsUseCase } from './application/use-cases/bulk-import-students.use-case'
import { STUDENT_REPOSITORY } from './domain/repositories/student.repository.interface'
import { PrismaStudentRepository } from './infrastructure/persistence/prisma-student.repository'
import { StudentBulkImportProcessor } from './infrastructure/queue/student-bulk-import.processor'
import { StudentsController } from './presentation/controllers/students.controller'

/**
 * StudentsModule — student CRUD + bulk CSV import (sync ≤500 rows,
 * async via BullMQ >500 rows). Tenant-scoped.
 *
 * Cross-cutting dependencies:
 *   - AuthModule — for `SetPasswordUseCase` (used in student
 *     create flow when no password is provided).
 *   - CsvModule — for the shared CSV parser.
 *   - CryptoModule — for the password hasher.
 *   - QueueModule — for the BullMQ Queue and Worker lifecycle.
 *   - PrismaModule — for the tenant-aware Prisma client.
 *   - TenantModule — for the tenant context.
 *
 * The BullMQ processor (`StudentBulkImportProcessor`) is
 * registered as a provider; its `onModuleInit` hook attaches a
 * Worker to the shared Redis connection. We start workers in the
 * same process for now (per the task 8.10 spec); splitting into
 * a dedicated worker container is a follow-up.
 */
@Module({
  imports: [PrismaModule, CryptoModule, AuthModule, CsvModule, QueueModule],
  controllers: [StudentsController],
  providers: [
    { provide: STUDENT_REPOSITORY, useClass: PrismaStudentRepository },
    CreateStudentUseCase,
    ListStudentsUseCase,
    GetStudentUseCase,
    UpdateStudentUseCase,
    DeactivateStudentUseCase,
    BulkImportStudentsUseCase,
    StudentBulkImportProcessor,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [STUDENT_REPOSITORY],
})
export class StudentsModule {}

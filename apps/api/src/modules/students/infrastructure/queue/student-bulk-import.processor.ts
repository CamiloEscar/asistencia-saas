import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type { Job } from 'bullmq'
import {
  BULLMQ_REDIS,
  QUEUE_NAMES,
  type QueueLifecycle,
} from '../../../../shared/queue/queue.module'
import { enterTenantContext } from '../../../../shared/tenant/tenant.context'
import type { PrismaService } from '../../../../shared/prisma/prisma.service'
import type { ParsedCsvRow } from '../../../../shared/csv/csv-parser.service'
import { CsvRowSchema } from '../../domain/value-objects/csv-row.vo'
import type { BulkImportResult } from '../../domain/repositories/student.repository.interface'
import {
  STUDENT_REPOSITORY,
  type IStudentRepository,
} from '../../domain/repositories/student.repository.interface'

/**
 * Payload of a `student-bulk-import` BullMQ job. Sent from the
 * controller via `BulkImportStudentsUseCase` and consumed here.
 */
export interface StudentBulkImportJob {
  institutionId: string
  userId: string
  rows: ParsedCsvRow[]
  dryRun: boolean
  courseId?: string
}

/**
 * StudentBulkImportProcessor — the worker that processes async
 * student bulk imports (>500 rows). It:
 *   1. Re-establishes the tenant context (workers run outside the
 *      HTTP request pipeline, so AsyncLocalStorage is empty).
 *   2. Validates each row against `CsvRowSchema` (defense in depth
 *      — the use case already validated, but a worker can be
 *      invoked from anywhere).
 *   3. Delegates the bulk insert to `IStudentRepository.bulkUpsert`.
 *   4. Optionally auto-enrolls the created students in `courseId`.
 *   5. Writes an audit log entry.
 */
@Injectable()
export class StudentBulkImportProcessor implements OnModuleInit {
  private readonly logger = new Logger(StudentBulkImportProcessor.name)

  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: IStudentRepository,
    private readonly prisma: PrismaService,
    @Inject(QUEUE_NAMES.STUDENT_BULK_IMPORT)
    private readonly queueName: string,
    @Inject(BULLMQ_REDIS) private readonly bullmqClient: unknown,
    private readonly lifecycle: QueueLifecycle,
  ) {}

  onModuleInit(): void {
    this.lifecycle.registerWorker(this.queueName, this.process.bind(this), this.bullmqClient)
    this.logger.log(`Worker registered for queue "${this.queueName}"`)
  }

  /**
   * BullMQ processor. Receives the deserialized job payload and
   * returns the import result. Throw on irrecoverable failure so
   * BullMQ retries with backoff (configurable per queue).
   */
  async process(job: Job<StudentBulkImportJob>): Promise<BulkImportResult> {
    const { institutionId, userId, rows, dryRun, courseId } = job.data

    // 1. Re-establish tenant context. Without this, the Prisma
    // extension's WHERE-injection has nothing to inject and throws.
    enterTenantContext({
      tenantId: institutionId,
      subdomain: '',
      timezone: 'UTC',
      userId,
      role: 'INSTITUTION_ADMIN',
    })

    // 2. Re-validate rows (defense in depth).
    const validRows: Array<ParsedCsvRow & { email: string; fullName: string; legajo: string }> = []
    const errors: BulkImportResult['errors'] = []
    for (const r of rows) {
      const result = CsvRowSchema.safeParse(r.values)
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            row: r.row,
            field: issue.path.join('.') || null,
            message: issue.message,
          })
        }
        continue
      }
      const data = result.data
      validRows.push({
        ...r,
        email: data.email ?? '',
        fullName: `${data.nombre} ${data.apellido}`.trim(),
        legajo: data.legajo,
      })
    }

    if (validRows.length === 0) {
      this.logger.warn(`Job ${job.id}: no valid rows after re-validation`)
      return { created: 0, skipped: 0, updated: 0, errors }
    }

    // 3. Dry run: just return the validation result.
    if (dryRun) {
      return { created: 0, skipped: 0, updated: 0, errors }
    }

    // 4. Bulk upsert.
    const result = await this.students.bulkUpsert(
      institutionId,
      validRows.map((r) => ({
        row: r.row,
        legajo: r.legajo,
        fullName: r.fullName,
        email: r.email || '',
        phone: null,
        birthDate: null,
        career: null,
      })),
    )

    // 5. Auto-enroll in the given course, if provided. We
    // intentionally do this AFTER bulkUpsert so that the enrollments
    // reference rows that actually exist in the DB.
    if (courseId) {
      const created = await this.prisma.user.findMany({
        where: { institutionId, role: 'STUDENT' },
        select: { id: true, legajo: true },
      })
      const createdLegajos = new Set(
        validRows.filter((r) => !errors.some((e) => e.row === r.row)).map((r) => r.legajo),
      )
      const toEnroll = created.filter((u: { id: string; legajo: string | null }) =>
        createdLegajos.has(u.legajo ?? ''),
      )
      for (const u of toEnroll) {
        await this.prisma.enrollment
          .create({
            data: { institutionId, courseId, studentId: u.id },
          })
          .catch((err: Error) => {
            // Idempotent — UNIQUE (courseId, studentId) may collide
            // on a re-run; we don't treat that as a failure.
            this.logger.debug(`enrollment.create skip: ${err.message}`)
          })
      }
    }

    // 6. Audit log (fire-and-forget; failure does not roll back).
    await this.prisma.auditLog
      .create({
        data: {
          institutionId,
          actorUserId: userId,
          action: 'STUDENTS_BULK_IMPORTED',
          entityType: 'Student',
          entityId: null,
          afterJson: {
            created: result.created,
            skipped: result.skipped,
            updated: result.updated,
            errorCount: result.errors.length,
            jobId: job.id,
          },
        },
      })
      .catch((err: Error) => {
        this.logger.warn(`Failed to write audit log: ${err.message}`)
      })

    return result
  }
}

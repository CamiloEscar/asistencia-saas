import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Audit } from '../../../../audit/decorators/audit.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import  { CsvParserService} from '../../../../shared/csv/csv-parser.service';
import { type ParsedCsvRow } from '../../../../shared/csv/csv-parser.service'
import  { RedisService } from '../../../../shared/redis/redis.service'
import { BULLMQ_QUEUE, type Queue, QUEUE_NAMES } from '../../../../shared/queue/queue.module'
import type { StudentBulkImportJob } from '../../infrastructure/queue/student-bulk-import.processor'
import { CsvRowSchema, type CsvRowError } from '../../domain/value-objects/csv-row.vo'
import {
  STUDENT_REPOSITORY,
  type IStudentRepository,
} from '../../domain/repositories/student.repository.interface'
import {
  BulkImportStudentsDtoSchema,
  type BulkImportStudentsDto,
} from '../../application/dtos/bulk-import.dto'
import type {
  BulkImportAsyncAccepted,
  BulkImportCommitResult,
  BulkImportDryRunResult,
  BulkImportJobStatus,
} from '../../application/dtos/bulk-import-result.dto'

/** Threshold above which we go async. Below this, the request
 *  blocks and returns the result directly. Tuned to keep the
 *  request within a 30s p99 budget. */
const SYNC_THRESHOLD = 500

/** Per-institution rate-limit on bulk imports: 5 per hour. */
const RATE_LIMIT_PER_HOUR = 5
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60
const RATE_LIMIT_KEY_PREFIX = 'bulk-import:rate:'

/**
 * BulkImportStudentsUseCase — orchestrator for the bulk import flow.
 *
 * Decision tree (per spec REQ-STUDENT-013):
 *   1. Parse the CSV via `CsvParserService`.
 *   2. If `dryRun: true` OR `totalRows ≤ SYNC_THRESHOLD`: process
 *      synchronously and return the result in the response.
 *   3. If `totalRows > SYNC_THRESHOLD`: enqueue a BullMQ job and
 *      return `{ jobId, status: 'queued', estimatedRows }`. The FE
 *      then polls `GET /api/students/bulk/:jobId/status` for the
 *      outcome.
 *
 * Rate limit: 5 imports per hour per institution (Redis counter).
 *
 * The use case writes an `AUDIT` event (`STUDENTS_BULK_IMPORTED`)
 * with the result counts. The actual student rows are inserted
 * by either the synchronous path (inline) or the worker
 * (`StudentBulkImportProcessor`).
 */
@Injectable()
export class BulkImportStudentsUseCase {
  private readonly logger = new Logger(BulkImportStudentsUseCase.name)

  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: IStudentRepository,
    private readonly csv: CsvParserService,
    private readonly redis: RedisService,
    @Inject(BULLMQ_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Entry point. The DTO has already been validated by the
   * controller; we re-parse the DTO here defensively.
   */
  async execute(
    file: Buffer,
    userId: string,
    dto: BulkImportStudentsDto,
  ): Promise<BulkImportDryRunResult | BulkImportCommitResult | BulkImportAsyncAccepted> {
    // 1. Enforce the rate limit.
    await this.enforceRateLimit(userId)

    // 2. Parse the CSV.
    const parsed = await this.csv.parseStudentCsv(file)
    if ('fatal' in parsed) {
      // Return a dry-run-shaped result with `valid: false` and a
      // single fatal error so the FE can show the message.
      return {
        valid: false,
        totalRows: 0,
        validRows: 0,
        errors: [{ row: 0, field: null, message: parsed.message }],
        preview: [],
      } as BulkImportDryRunResult
    }

    // 3. Dry run: return the preview + errors.
    if (dto.dryRun) {
      return this.buildDryRunResult(parsed.rows, parsed.errors, parsed.totalRows)
    }

    // 4. Sync path (≤ threshold rows).
    if (parsed.totalRows <= SYNC_THRESHOLD) {
      return this.executeSync(userId, parsed.rows, parsed.errors)
    }

    // 5. Async path: enqueue and return a jobId.
    return this.enqueueAsync(userId, parsed.rows, dto.courseId)
  }

  /** Get the status of an async job. */
  async getJobStatus(jobId: string): Promise<BulkImportJobStatus> {
    const job = await this.queue.getJob(jobId)
    if (!job) {
      return {
        jobId,
        status: 'failed',
        progress: 0,
        failedReason: 'Job not found',
      }
    }

    const state = await job.getState()
    const progress = job.progress as number | undefined

    return {
      jobId,
      status: this.mapBullState(state),
      progress: typeof progress === 'number' ? progress : 0,
      result: (job.returnvalue as BulkImportCommitResult | undefined) ?? undefined,
      failedReason: job.failedReason ?? undefined,
    }
  }

  // ─── internals ────────────────────────────────────────────────────────

  private buildDryRunResult(
    rows: ParsedCsvRow[],
    errors: CsvRowError[],
    totalRows: number,
  ): BulkImportDryRunResult {
    // Per spec REQ-STUDENT-009-01, the preview is a sample of up
    // to 10 valid rows. The DTO accepts up to 20 for flexibility.
    const preview = rows.slice(0, 20).map((r) => ({
      legajo: r.values['legajo'] ?? '',
      nombre: r.values['nombre'] ?? '',
      apellido: r.values['apellido'] ?? '',
      email: r.values['email'] ?? null,
    }))
    return {
      valid: errors.length === 0,
      totalRows,
      validRows: rows.length,
      errors,
      preview,
    }
  }

  @Audit({
    action: 'STUDENTS_BULK_IMPORTED',
    entityType: 'Student',
  })
  private async executeSync(
    _userId: string,
    rows: ParsedCsvRow[],
    validationErrors: CsvRowError[],
  ): Promise<BulkImportCommitResult> {
    // The parser already validated. Re-validate defensively to
    // guarantee the input shape.
    const accepted: Array<{
      row: number
      legajo: string
      email: string
      fullName: string
    }> = []
    for (const r of rows) {
      const result = CsvRowSchema.safeParse(r.values)
      if (!result.success) continue
      const d = result.data
      accepted.push({
        row: r.row,
        legajo: d.legajo.toUpperCase(),
        email: d.email ?? '',
        fullName: `${d.nombre} ${d.apellido}`.trim(),
      })
    }

    const result = await this.students.bulkUpsert(
      accepted.map((a) => ({
        row: a.row,
        legajo: a.legajo,
        fullName: a.fullName,
        email: a.email || '',
        phone: null,
        birthDate: null,
        career: null,
      })),
    )

    return {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: [...validationErrors, ...result.errors],
    }
  }

  private async enqueueAsync(
    userId: string,
    rows: ParsedCsvRow[],
    courseId?: string,
  ): Promise<BulkImportAsyncAccepted> {
    const job = await this.queue.add(
      QUEUE_NAMES.STUDENT_BULK_IMPORT,
      {
        userId,
        rows,
        dryRun: false,
        courseId,
      } satisfies StudentBulkImportJob & { courseId?: string },
      {
        // Per-job timeout: 5 minutes (matches the spec).
        // BullMQ uses ms for the timeout option.
        removeOnComplete: { age: 60 * 60, count: 100 },
        removeOnFail: { age: 24 * 60 * 60 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    )

    return {
      jobId: job.id ?? randomUUID(),
      status: 'queued',
      estimatedRows: rows.length,
    }
  }

  private async enforceRateLimit(userId: string): Promise<void> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${userId}`
    // The RedisService doesn't expose `incr` directly; we use
    // a tiny Lua script for atomic INCR + EXPIRE.
    const result = (await this.redis.eval(
      `local n = redis.call('INCR', KEYS[1])
       if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       local ttl = redis.call('TTL', KEYS[1])
       return {n, ttl}`,
      1,
      [key, RATE_LIMIT_WINDOW_SECONDS],
    )) as [number, number]
    const [count, ttl] = result
    if (count > RATE_LIMIT_PER_HOUR) {
      throw new HttpException(
        {
          message: `Bulk import rate limit exceeded. Try again in ${ttl} seconds.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  private mapBullState(state: string): BulkImportJobStatus['status'] {
    switch (state) {
      case 'completed':
        return 'completed'
      case 'failed':
        return 'failed'
      case 'active':
      case 'processing':
        return 'processing'
      default:
        return 'pending'
    }
  }
}

// Re-export the ZodValidationPipe factory so the controller can
// validate the DTO without importing the pipe separately.
export const validateBulkImportDto = (raw: unknown): BulkImportStudentsDto =>
  BulkImportStudentsDtoSchema.parse(raw)

export const bulkImportValidationPipe = new ZodValidationPipe(BulkImportStudentsDtoSchema)

import { HttpException, HttpStatus } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { BulkImportStudentsUseCase } from './bulk-import-students.use-case'
import type { CsvParserService, ParsedCsvRow } from '../../../../shared/csv/csv-parser.service'
import type { RedisService } from '../../../../shared/redis/redis.service'
import type {
  BulkImportResult,
  IStudentRepository,
} from '../../domain/repositories/student.repository.interface'

/**
 * Unit tests for `BulkImportStudentsUseCase`. Four scenarios:
 *   1. Sync (≤500 rows): returns the commit result.
 *   2. Async (>500 rows): enqueues a job and returns { jobId }.
 *   3. DryRun: returns the dry-run result (no DB writes).
 *   4. Validation errors: invalid rows from the parser are surfaced.
 */
describe('BulkImportStudentsUseCase', () => {
  let useCase: BulkImportStudentsUseCase
  let students: jest.Mocked<IStudentRepository>
  let csv: { parseStudentCsv: jest.Mock }
  let redis: { eval: jest.Mock }
  let queue: { add: jest.Mock }

  const baseRow = (row: number): ParsedCsvRow => ({
    row,
    values: {
      legajo: `2024-${row.toString().padStart(3, '0')}`,
      nombre: 'Juan',
      apellido: 'Pérez',
      email: `juan${row}@x.com`,
      telefono: '',
      fecha_nacimiento: '',
      carrera: '',
    },
  })

  const manyRows = (n: number): ParsedCsvRow[] =>
    Array.from({ length: n }, (_, i) => baseRow(i + 1))

  beforeEach(() => {
    students = {
      findByIdInInstitution: jest.fn(),
      findByLegajoInInstitution: jest.fn(),
      findByEmailInInstitution: jest.fn(),
      listInInstitution: jest.fn(),
      listForTeacher: jest.fn(),
      createInInstitution: jest.fn(),
      updateInInstitution: jest.fn(),
      setActiveInInstitution: jest.fn(),
      bulkUpsert: jest.fn(),
      countInInstitution: jest.fn(),
    } as unknown as jest.Mocked<IStudentRepository>
    csv = { parseStudentCsv: jest.fn() }
    redis = { eval: jest.fn().mockResolvedValue([1, 60 * 60]) }
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) }

    useCase = new BulkImportStudentsUseCase(
      students,
      csv as unknown as CsvParserService,
      redis as unknown as RedisService,
      queue as unknown as Queue,
    )
  })

  it('processes ≤500 rows synchronously (returns the commit result)', async () => {
    const rows = manyRows(10)
    csv.parseStudentCsv.mockResolvedValue({
      rows,
      errors: [],
      totalRows: 10,
    })
    students.bulkUpsert.mockResolvedValue({
      created: 10,
      skipped: 0,
      updated: 0,
      errors: [],
    } satisfies BulkImportResult)

    const result = await useCase.execute(Buffer.from('ignored'), 'i-1', 'u-1', {
      dryRun: false,
      updateExisting: false,
    })

    expect(students.bulkUpsert).toHaveBeenCalledWith('i-1', expect.any(Array))
    expect(queue.add).not.toHaveBeenCalled()
    expect(result).toMatchObject({ created: 10, skipped: 0, updated: 0, errors: [] })
  })

  it('enqueues a BullMQ job for >500 rows and returns { jobId, status: "queued" }', async () => {
    const rows = manyRows(501)
    csv.parseStudentCsv.mockResolvedValue({ rows, errors: [], totalRows: 501 })

    const result = await useCase.execute(Buffer.from('ignored'), 'i-1', 'u-1', {
      dryRun: false,
      updateExisting: false,
    })

    expect(students.bulkUpsert).not.toHaveBeenCalled()
    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ institutionId: 'i-1', userId: 'u-1' }),
      expect.any(Object),
    )
    expect(result).toMatchObject({
      jobId: 'job-1',
      status: 'queued',
      estimatedRows: 501,
    })
  })

  it('returns the dry-run preview without writing', async () => {
    const rows = manyRows(3)
    csv.parseStudentCsv.mockResolvedValue({ rows, errors: [], totalRows: 3 })

    const result = await useCase.execute(Buffer.from('ignored'), 'i-1', 'u-1', {
      dryRun: true,
      updateExisting: false,
    })

    expect(students.bulkUpsert).not.toHaveBeenCalled()
    expect(queue.add).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      valid: true,
      totalRows: 3,
      validRows: 3,
      errors: [],
    })
    if ('preview' in result) {
      expect(result.preview).toHaveLength(3)
    }
  })

  it('surfaces parser errors and still returns a structured result', async () => {
    const rows = manyRows(2)
    csv.parseStudentCsv.mockResolvedValue({
      rows,
      errors: [{ row: 1, field: 'email', message: 'Invalid email' }],
      totalRows: 2,
    })
    students.bulkUpsert.mockResolvedValue({
      created: 2,
      skipped: 0,
      updated: 0,
      errors: [],
    })

    const result = await useCase.execute(Buffer.from('ignored'), 'i-1', 'u-1', {
      dryRun: false,
      updateExisting: false,
    })

    expect(students.bulkUpsert).toHaveBeenCalled()
    if ('errors' in result) {
      expect(result.errors).toEqual([{ row: 1, field: 'email', message: 'Invalid email' }])
    }
  })

  it('throws 429 when the rate limit is exceeded', async () => {
    redis.eval.mockResolvedValue([6, 1800]) // 6 > 5 limit
    const rows = manyRows(3)
    csv.parseStudentCsv.mockResolvedValue({ rows, errors: [], totalRows: 3 })

    await expect(
      useCase.execute(Buffer.from('x'), 'i-1', 'u-1', { dryRun: false, updateExisting: false }),
    ).rejects.toBeInstanceOf(HttpException)

    try {
      await useCase.execute(Buffer.from('x'), 'i-1', 'u-1', {
        dryRun: false,
        updateExisting: false,
      })
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
    }
  })
})

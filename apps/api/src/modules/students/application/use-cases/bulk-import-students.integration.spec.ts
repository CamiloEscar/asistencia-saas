/**
 * Integration test for the bulk import flow. Uses an in-memory
 * CsvParserService double and the same in-memory student repo
 * from `student-crud.integration.spec.ts` to exercise the use
 * case end-to-end (sync + async paths). E2E with testcontainers
 * is a follow-up.
 *
 * Covers: small sync path (≤500 rows), large async path
 * (>500 rows) returns a jobId, dry-run returns the preview.
 */
import { BulkImportStudentsUseCase } from './bulk-import-students.use-case'
import type { CsvParserService, ParsedCsvRow } from '../../../../shared/csv/csv-parser.service'
import type { RedisService } from '../../../../shared/redis/redis.service'
import { NotFoundException } from '@nestjs/common'
import type {
  IStudentRepository,
  ListStudentsResult,
} from '../../domain/repositories/student.repository.interface'
import { Student, type StudentExtras } from '../../domain/entities/student.entity'
import type { Queue } from 'bullmq'

/** Minimal in-memory student repository (same shape as the one
 *  in `student-crud.integration.spec.ts`). */
class InMemoryStudentRepo implements IStudentRepository {
  private next = 1
  private rows = new Map<string, Record<string, unknown>>()
  private toStudent(r: Record<string, unknown>): Student {
    const extras: StudentExtras = {
      legajo: (r.legajo as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      birthDate: (r.birthDate as Date | null) ?? null,
      career: (r.career as string | null) ?? null,
    }
    return Student.fromUser(
      {
        id: r.id as string,
        email: r.email as string,
        passwordHash: (r.passwordHash as string | null) ?? null,
        fullName: r.fullName as string,
        role: 'STUDENT',
        status: (r.status as 'ACTIVE' | 'INACTIVE') ?? 'ACTIVE',
      } as never,
      extras,
    )
  }
  async findById(id: string) {
    return this.rows.has(id) ? (this.toStudent(this.rows.get(id)!) as never) : null
  }
  async findByLegajo(legajo: string) {
    for (const r of this.rows.values()) {
      if (r.legajo === legajo.toUpperCase()) {
        return this.toStudent(r) as never
      }
    }
    return null
  }
  async findByEmail(email: string) {
    for (const r of this.rows.values()) {
      if (r.email === email.toLowerCase()) {
        return this.toStudent(r) as never
      }
    }
    return null
  }
  async list() {
    const data = Array.from(this.rows.values()).map((r) => this.toStudent(r))
    return { data: data as never, nextCursor: null, hasMore: false } satisfies ListStudentsResult
  }
  async listForTeacher() {
    return { data: [], nextCursor: null, hasMore: false } satisfies ListStudentsResult
  }
  async create(input: {
    email: string
    passwordHash: string | null
    fullName: string
    legajo: string
    phone?: string | null
    birthDate?: Date | null
    career?: string | null
  }) {
    const id = `u-${this.next++}`
    const r: Record<string, unknown> = {
      id,
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      role: 'STUDENT',
      status: 'ACTIVE',
      legajo: input.legajo.toUpperCase(),
      phone: input.phone ?? null,
      birthDate: input.birthDate ?? null,
      career: input.career ?? null,
    }
    this.rows.set(id, r)
    return this.toStudent(r) as never
  }
  async update(id: string, input: Record<string, unknown>) {
    const r = this.rows.get(id)
    if (!r) throw new NotFoundException({ message: 'Student not found' })
    Object.assign(r, input)
    return this.toStudent(r) as never
  }
  async setActive(id: string, isActive: boolean) {
    const r = this.rows.get(id)
    if (!r) throw new NotFoundException({ message: 'Student not found' })
    r.status = isActive ? 'ACTIVE' : 'INACTIVE'
    return this.toStudent(r) as never
  }
  async bulkUpsert(
    rows: Array<{
      row: number
      legajo: string
      email: string | null
      fullName: string
      phone?: string | null
      birthDate?: Date | null
      career?: string | null
    }>,
  ) {
    let created = 0
    let skipped = 0
    for (const r of rows) {
      const existing = await this.findByLegajo(r.legajo)
      if (existing) {
        skipped += 1
        continue
      }
      await this.create({
        email: r.email ?? `${r.legajo.toLowerCase()}@imported.local`,
        passwordHash: null,
        fullName: r.fullName,
        legajo: r.legajo,
        phone: r.phone,
        birthDate: r.birthDate,
        career: r.career,
      })
      created += 1
    }
    return { created, skipped, updated: 0, errors: [] }
  }
  async count() {
    return this.rows.size
  }
}

/** Build a parsed-csv stub for the parser. */
const stubCsv = (
  rows: ParsedCsvRow[],
  total: number,
): Pick<CsvParserService, 'parseStudentCsv'> => ({
  parseStudentCsv: jest.fn().mockResolvedValue({ rows, errors: [], totalRows: total }),
})

const stubRedis = (): Pick<RedisService, 'eval'> => ({
  eval: jest.fn().mockResolvedValue([1, 3600]),
})

const stubQueue = (): { add: jest.Mock; getJob: jest.Mock } => ({
  add: jest.fn().mockResolvedValue({ id: 'job-async' }),
  getJob: jest.fn(),
})

describe('Bulk import (integration)', () => {
  let students: InMemoryStudentRepo
  let queue: { add: jest.Mock; getJob: jest.Mock }

  beforeEach(() => {
    students = new InMemoryStudentRepo()
    queue = stubQueue()
  })

  it('processes a small CSV (10 rows) synchronously', async () => {
    const rows: ParsedCsvRow[] = Array.from({ length: 10 }, (_, i) => ({
      row: i + 1,
      values: {
        legajo: `2024-${(i + 1).toString().padStart(3, '0')}`,
        nombre: 'Juan',
        apellido: 'Pérez',
        email: '',
        telefono: '',
        fecha_nacimiento: '',
        carrera: '',
      },
    }))
    const useCase = new BulkImportStudentsUseCase(
      students,
      stubCsv(rows, 10) as CsvParserService,
      stubRedis() as RedisService,
      queue as unknown as Queue,
    )

    const result = await useCase.execute(Buffer.from('ignored'), 'u-1', {
      dryRun: false,
      updateExisting: false,
    })

    expect(await students.count()).toBe(10)
    expect(queue.add).not.toHaveBeenCalled()
    expect(result).toMatchObject({ created: 10, skipped: 0 })
  })

  it('re-imports the same CSV and skips the duplicates', async () => {
    const rows: ParsedCsvRow[] = Array.from({ length: 5 }, (_, i) => ({
      row: i + 1,
      values: {
        legajo: `2024-${(i + 1).toString().padStart(3, '0')}`,
        nombre: 'Juan',
        apellido: 'Pérez',
        email: '',
        telefono: '',
        fecha_nacimiento: '',
        carrera: '',
      },
    }))
    const useCase = new BulkImportStudentsUseCase(
      students,
      stubCsv(rows, 5) as CsvParserService,
      stubRedis() as RedisService,
      queue as unknown as Queue,
    )

    // First import — creates 5.
    await useCase.execute(Buffer.from('x'), 'u-1', { dryRun: false, updateExisting: false })
    // Second import — all 5 skipped.
    const second = await useCase.execute(Buffer.from('x'), 'u-1', {
      dryRun: false,
      updateExisting: false,
    })

    expect(await students.count()).toBe(5)
    if ('created' in second) {
      expect(second.created).toBe(0)
      expect(second.skipped).toBe(5)
    }
  })

  it('enqueues a job for >500 rows and returns { jobId, status: "queued" }', async () => {
    const rows: ParsedCsvRow[] = Array.from({ length: 600 }, (_, i) => ({
      row: i + 1,
      values: {
        legajo: `2024-${(i + 1).toString().padStart(3, '0')}`,
        nombre: 'Juan',
        apellido: 'Pérez',
        email: '',
        telefono: '',
        fecha_nacimiento: '',
        carrera: '',
      },
    }))
    const useCase = new BulkImportStudentsUseCase(
      students,
      stubCsv(rows, 600) as CsvParserService,
      stubRedis() as RedisService,
      queue as unknown as Queue,
    )

    const result = await useCase.execute(Buffer.from('x'), 'u-1', {
      dryRun: false,
      updateExisting: false,
    })

    expect(queue.add).toHaveBeenCalled()
    expect(await students.count()).toBe(0) // async — not yet applied
    expect(result).toMatchObject({ jobId: 'job-async', status: 'queued', estimatedRows: 600 })
  })

  it('returns the dry-run preview without writing', async () => {
    const rows: ParsedCsvRow[] = [
      {
        row: 1,
        values: {
          legajo: '2024-001',
          nombre: 'Juan',
          apellido: 'Pérez',
          email: '',
          telefono: '',
          fecha_nacimiento: '',
          carrera: '',
        },
      },
    ]
    const useCase = new BulkImportStudentsUseCase(
      students,
      stubCsv(rows, 1) as CsvParserService,
      stubRedis() as RedisService,
      queue as unknown as Queue,
    )

    const result = await useCase.execute(Buffer.from('x'), 'u-1', {
      dryRun: true,
      updateExisting: false,
    })

    expect(await students.count()).toBe(0)
    expect(queue.add).not.toHaveBeenCalled()
    expect(result).toMatchObject({ valid: true, totalRows: 1, validRows: 1 })
  })
})

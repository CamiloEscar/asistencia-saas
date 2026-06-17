/**
 * Integration test for the student CRUD lifecycle. Uses an
 * in-memory mock of `PrismaStudentRepository` to exercise the
 * use cases end-to-end without a real DB. E2E with testcontainers
 * is a follow-up (out of scope for this change).
 *
 * Covers: create → list → update → deactivate.
 */
import { ConflictException, NotFoundException } from '@nestjs/common'
import type { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import type { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'
import { CreateStudentUseCase } from './create-student.use-case'
import { ListStudentsUseCase } from './list-students.use-case'
import { UpdateStudentUseCase } from './update-student.use-case'
import { DeactivateStudentUseCase } from './deactivate-student.use-case'
import { Student, type StudentExtras } from '../../domain/entities/student.entity'
import type {
  CreateStudentInput,
  IStudentRepository,
  ListStudentsInput,
  ListStudentsResult,
  UpdateStudentInput,
} from '../../domain/repositories/student.repository.interface'

/**
 * In-memory implementation of `IStudentRepository`. Mirrors the
 * Prisma `createMany` semantics (`skipDuplicates: true`) and
 * the tenant-scoped `findByIdInInstitution` etc. This lets us
 * exercise the use cases without a real DB.
 */
class InMemoryStudentRepository implements IStudentRepository {
  private next = 1
  private students = new Map<string, Record<string, unknown>>()

  private genId(): string {
    return `u-${this.next++}`
  }

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
        institutionId: (r.institutionId as string | null) ?? null,
      } as never,
      extras,
    )
  }

  async findByIdInInstitution(institutionId: string, id: string) {
    const r = this.students.get(id)
    if (!r || r.institutionId !== institutionId) return null
    return this.toStudent(r) as never
  }
  async findByLegajoInInstitution(institutionId: string, legajo: string) {
    for (const r of this.students.values()) {
      if (r.institutionId === institutionId && r.legajo === legajo.toUpperCase()) {
        return this.toStudent(r) as never
      }
    }
    return null
  }
  async findByEmailInInstitution(institutionId: string, email: string) {
    for (const r of this.students.values()) {
      if (r.institutionId === institutionId && r.email === email.toLowerCase()) {
        return this.toStudent(r) as never
      }
    }
    return null
  }
  async listInInstitution(_institutionId: string, _input: ListStudentsInput) {
    const rows = Array.from(this.students.values())
      .filter((r) => r.institutionId === _institutionId)
      .map((r) => this.toStudent(r))
    return { data: rows as never, nextCursor: null, hasMore: false } satisfies ListStudentsResult
  }
  async listForTeacher(_i: string, _t: string, _input: ListStudentsInput) {
    return { data: [], nextCursor: null, hasMore: false } satisfies ListStudentsResult
  }
  async createInInstitution(input: CreateStudentInput) {
    const id = this.genId()
    const row: Record<string, unknown> = {
      id,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      role: 'STUDENT',
      status: 'ACTIVE',
      institutionId: input.institutionId,
      legajo: input.legajo.toUpperCase(),
      phone: input.phone ?? null,
      birthDate: input.birthDate ?? null,
      career: input.career ?? null,
    }
    this.students.set(id, row)
    return this.toStudent(row) as never
  }
  async updateInInstitution(institutionId: string, id: string, input: UpdateStudentInput) {
    const r = this.students.get(id)
    if (!r || r.institutionId !== institutionId) {
      throw new NotFoundException({ message: 'Student not found' })
    }
    if (input.fullName !== undefined) r.fullName = input.fullName
    if (input.email !== undefined) r.email = input.email.toLowerCase()
    if (input.legajo !== undefined) r.legajo = input.legajo.toUpperCase()
    if (input.phone !== undefined) r.phone = input.phone
    if (input.birthDate !== undefined) r.birthDate = input.birthDate
    if (input.career !== undefined) r.career = input.career
    return this.toStudent(r) as never
  }
  async setActiveInInstitution(institutionId: string, id: string, isActive: boolean) {
    const r = this.students.get(id)
    if (!r || r.institutionId !== institutionId) {
      throw new NotFoundException({ message: 'Student not found' })
    }
    r.status = isActive ? 'ACTIVE' : 'INACTIVE'
    return this.toStudent(r) as never
  }
  async bulkUpsert(
    institutionId: string,
    rows: Array<Omit<CreateStudentInput, 'institutionId' | 'passwordHash'> & { row: number }>,
  ) {
    let created = 0
    let skipped = 0
    for (const r of rows) {
      const existing = await this.findByLegajoInInstitution(institutionId, r.legajo)
      if (existing) {
        skipped += 1
        continue
      }
      await this.createInInstitution({ ...r, institutionId, passwordHash: null })
      created += 1
    }
    return { created, skipped, updated: 0, errors: [] }
  }
  async countInInstitution(institutionId: string) {
    return Array.from(this.students.values()).filter((r) => r.institutionId === institutionId)
      .length
  }
}

describe('Student CRUD lifecycle (integration)', () => {
  let students: InMemoryStudentRepository
  let passwordHasher: jest.Mocked<PasswordHasherService>
  let setPassword: jest.Mocked<SetPasswordUseCase>
  const institutionId = 'i-1'

  beforeEach(() => {
    students = new InMemoryStudentRepository()
    passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed-pw'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherService>
    setPassword = { issue: jest.fn() } as unknown as jest.Mocked<SetPasswordUseCase>
  })

  it('create → list → update → deactivate', async () => {
    const create = new CreateStudentUseCase(students, passwordHasher, setPassword)
    const list = new ListStudentsUseCase(students)
    const update = new UpdateStudentUseCase(students)
    const deactivate = new DeactivateStudentUseCase(students)

    // 1. Create
    const created = await create.execute(
      { legajo: '2024-001', fullName: 'Juan Pérez', sendActivationLink: false },
      institutionId,
    )
    expect(created.student.email).toMatch(/imported\.local/)
    expect(created.student.legajo).toBe('2024-001')
    expect(created.student.isActive).toBe(true)
    const id = created.student.id

    // 2. List
    const l = await list.execute(institutionId, {})
    expect(l.data.length).toBe(1)

    // 3. Update name
    const updated = await update.execute(institutionId, id, { fullName: 'Juan P.' })
    expect(updated.fullName).toBe('Juan P.')

    // 4. Deactivate
    const deactivated = await deactivate.execute(institutionId, id)
    expect(deactivated.isActive).toBe(false)

    // Final list count is still 1 (soft delete preserves history).
    const finalList = await list.execute(institutionId, {})
    expect(finalList.data.length).toBe(1)
  })

  it('rejects a duplicate legajo in the same institution', async () => {
    const create = new CreateStudentUseCase(students, passwordHasher, setPassword)
    await create.execute(
      { legajo: '2024-001', fullName: 'A', sendActivationLink: false },
      institutionId,
    )
    await expect(
      create.execute(
        { legajo: '2024-001', fullName: 'B', sendActivationLink: false },
        institutionId,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('404s when updating a non-existent student', async () => {
    const update = new UpdateStudentUseCase(students)
    await expect(update.execute(institutionId, 'u-999', { fullName: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})

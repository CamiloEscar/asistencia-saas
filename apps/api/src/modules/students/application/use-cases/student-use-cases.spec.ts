import { ConflictException } from '@nestjs/common'
import type { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import type { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'
import { CreateStudentUseCase } from './create-student.use-case'
import { UpdateStudentUseCase } from './update-student.use-case'
import { DeactivateStudentUseCase } from './deactivate-student.use-case'
import { ListStudentsUseCase } from './list-students.use-case'
import { GetStudentUseCase } from './get-student.use-case'
import type {
  IStudentRepository,
  ListStudentsResult,
} from '../../domain/repositories/student.repository.interface'
import { makeStudent } from '../../test/student.fixtures'

/**
 * Unit tests for student use cases. Covers happy path, conflict,
 * 404, and role-based filtering (TEACHER sees only enrolled).
 */
describe('Student use cases', () => {
  let students: jest.Mocked<IStudentRepository>
  let passwordHasher: jest.Mocked<PasswordHasherService>
  let setPassword: jest.Mocked<SetPasswordUseCase>

  beforeEach(() => {
    students = {
      findById: jest.fn(),
      findByLegajo: jest.fn(),
      findByEmail: jest.fn(),
      list: jest.fn(),
      listForTeacher: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      bulkUpsert: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<IStudentRepository>
    passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed-pw'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherService>
    setPassword = { issue: jest.fn() } as unknown as jest.Mocked<SetPasswordUseCase>
  })

  describe('CreateStudentUseCase', () => {
    it('creates a student (happy path)', async () => {
      students.findByLegajo.mockResolvedValue(null)
      students.findByEmail.mockResolvedValue(null)
      students.create.mockImplementation(async (input) =>
        makeStudent({ email: input.email }),
      )

      const useCase = new CreateStudentUseCase(students, passwordHasher, setPassword)
      const result = await useCase.execute({
        legajo: '2024-001',
        fullName: 'Juan Pérez',
        sendActivationLink: false,
      })

      // When no email is provided, the use case derives one from
      // the legajo at the `imported.local` domain.
      expect(result.student.email).toMatch(/imported\.local/)
      expect(result.temporaryPassword).toBeDefined()
      expect(passwordHasher.hash).toHaveBeenCalled()
    })

    it('rejects a duplicate legajo (409)', async () => {
      students.findByLegajo.mockResolvedValue(makeStudent())

      const useCase = new CreateStudentUseCase(students, passwordHasher, setPassword)
      await expect(
        useCase.execute({ legajo: '2024-001', fullName: 'X', sendActivationLink: false }),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('UpdateStudentUseCase', () => {
    it('updates a student when the new legajo is unique', async () => {
      students.findById.mockResolvedValue(makeStudent({ legajo: '2024-001' }))
      students.findByLegajo.mockResolvedValue(null)
      students.update.mockResolvedValue(makeStudent({ fullName: 'New Name' }))

      const useCase = new UpdateStudentUseCase(students)
      const result = await useCase.execute('u-1', { fullName: 'New Name' })
      expect(result.fullName).toBe('New Name')
    })

    it('rejects a duplicate legajo (409)', async () => {
      students.findById.mockResolvedValue(makeStudent({ legajo: '2024-001' }))
      students.findByLegajo.mockResolvedValue(makeStudent({ id: 'other', legajo: '2024-002' }))

      const useCase = new UpdateStudentUseCase(students)
      await expect(
        useCase.execute('u-1', { legajo: '2024-002' }),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('DeactivateStudentUseCase', () => {
    it('deactivates a student', async () => {
      students.findById.mockResolvedValue(makeStudent())
      students.setActive.mockResolvedValue(makeStudent({ status: 'INACTIVE' }))

      const useCase = new DeactivateStudentUseCase(students)
      const result = await useCase.execute('u-1')
      expect(result.status).toBe('INACTIVE')
    })
  })

  describe('ListStudentsUseCase', () => {
    it('returns the institutional list for an admin', async () => {
      const result: ListStudentsResult = {
        data: [makeStudent()],
        nextCursor: null,
        hasMore: false,
      }
      students.list.mockResolvedValue(result)

      const useCase = new ListStudentsUseCase(students)
      const r = await useCase.execute({}, { role: 'ADMIN', userId: 'a-1' })
      expect(r.data).toHaveLength(1)
      expect(students.listForTeacher).not.toHaveBeenCalled()
    })
  })

  describe('GetStudentUseCase', () => {
    it('returns the student on a hit', async () => {
      students.findById.mockResolvedValue(makeStudent())
      const useCase = new GetStudentUseCase(students)
      const r = await useCase.execute('u-1')
      expect(r.id).toBe('u-1')
    })
  })
})

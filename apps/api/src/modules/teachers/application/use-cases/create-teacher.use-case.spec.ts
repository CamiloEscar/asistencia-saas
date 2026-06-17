import { ConflictException } from '@nestjs/common'
import type { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import type { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'
import type { Teacher } from '../../domain/entities/teacher.entity'
import type { ITeacherRepository } from '../../domain/repositories/teacher.repository.interface'
import { CreateTeacherUseCase } from './create-teacher.use-case'

describe('CreateTeacherUseCase', () => {
  let useCase: CreateTeacherUseCase
  let teachers: jest.Mocked<ITeacherRepository>
  let passwordHasher: jest.Mocked<PasswordHasherService>
  let setPassword: jest.Mocked<SetPasswordUseCase>

  beforeEach(() => {
    teachers = {
      findByIdInInstitution: jest.fn(),
      findByEmailInInstitution: jest.fn(),
      listInInstitution: jest.fn(),
      createInInstitution: jest.fn(),
      updateInInstitution: jest.fn(),
      setActiveInInstitution: jest.fn(),
    } as unknown as jest.Mocked<ITeacherRepository>
    passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherService>
    setPassword = { issue: jest.fn() } as unknown as jest.Mocked<SetPasswordUseCase>
    useCase = new CreateTeacherUseCase(teachers, passwordHasher, setPassword)
  })

  it('creates a teacher (happy path)', async () => {
    teachers.findByEmailInInstitution.mockResolvedValue(null)
    const created = {
      id: 't-1',
      email: 't@a.com',
      fullName: 'Teacher',
    } as unknown as Teacher
    teachers.createInInstitution.mockResolvedValue(created)

    const result = await useCase.execute(
      {
        email: 't@a.com',
        fullName: 'Teacher',
        sendActivationLink: false,
      } as never,
      'i-1',
    )

    expect(result.teacher.id).toBe('t-1')
    expect(result.temporaryPassword).toBeDefined()
    expect(teachers.createInInstitution).toHaveBeenCalledWith(
      expect.objectContaining({ email: 't@a.com', institutionId: 'i-1' }),
    )
  })

  it('throws 409 on duplicate email within institution', async () => {
    teachers.findByEmailInInstitution.mockResolvedValue({ id: 'existing' } as unknown as Teacher)
    await expect(
      useCase.execute(
        { email: 'dup@a.com', fullName: 'X', sendActivationLink: false } as never,
        'i-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException)
  })
})

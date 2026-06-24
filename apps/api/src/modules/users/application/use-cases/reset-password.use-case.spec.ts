import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import type { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'
import type { User } from '../../../auth/domain/entities/user.entity'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import { ResetPasswordUseCase } from './reset-password.use-case'

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase
  let users: jest.Mocked<IUserRepository>
  let passwordHasher: jest.Mocked<PasswordHasherService>
  let setPassword: jest.Mocked<SetPasswordUseCase>

  const baseUser = {
    id: 'u-1',
    email: 'a@x.com',
    fullName: 'A',
    role: 'TEACHER',
    status: 'ACTIVE',
  } as unknown as User

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      setPasswordHash: jest.fn(),
      countByRole: jest.fn(),
      toEntity: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>
    passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed-new'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherService>
    setPassword = {
      issue: jest.fn().mockResolvedValue({ resetUrl: 'https://example.com/set?token=abc' }),
    } as unknown as jest.Mocked<SetPasswordUseCase>

    useCase = new ResetPasswordUseCase(users, passwordHasher, setPassword)
  })

  it('rejects self-reset (400)', async () => {
    await expect(useCase.execute('u-1', 'u-1')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('throws 404 when target not found', async () => {
    users.findById.mockResolvedValue(null)
    await expect(useCase.execute('actor-1', 'u-9')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('generates a new password and returns it', async () => {
    users.findById.mockResolvedValue(baseUser)
    const result = await useCase.execute('actor-1', 'u-1')
    expect(result.temporaryPassword).toBeDefined()
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(16)
    expect(passwordHasher.hash).toHaveBeenCalled()
    expect(users.setPasswordHash).toHaveBeenCalledWith('u-1', 'hashed-new')
  })
})

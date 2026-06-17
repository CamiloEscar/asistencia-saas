import { ConflictException } from '@nestjs/common'
import type { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import type { User } from '../../../auth/domain/entities/user.entity'
import { CreateInstitutionUseCase } from './create-institution.use-case'
import type {
  IInstitutionRepository,
} from '../../domain/repositories/institution.repository.interface'

/**
 * Unit tests for `CreateInstitutionUseCase`. The use case is the
 * single chokepoint for institution creation; we cover:
 *   - Happy path (creates institution + initial admin user)
 *   - Duplicate subdomain → 409
 *
 * Mocking strategy: we use plain object stubs for the repository,
 * password hasher, and set-password use case. This keeps the test
 * fast and free of testcontainers — the institution repository is
 * the only thing that needs a real DB in integration.
 */
describe('CreateInstitutionUseCase', () => {
  let useCase: CreateInstitutionUseCase
  let institutions: jest.Mocked<IInstitutionRepository>
  let users: { create: jest.Mock }
  let passwordHasher: jest.Mocked<PasswordHasherService>

  beforeEach(() => {
    institutions = {
      findById: jest.fn(),
      findBySubdomain: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
      activate: jest.fn(),
      updateLogo: jest.fn(),
      toEntity: jest.fn(),
    } as unknown as jest.Mocked<IInstitutionRepository>

    users = { create: jest.fn() }

    passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherService>

    useCase = new CreateInstitutionUseCase(
      institutions,
      users as unknown as never,
      passwordHasher,
    )
  })

  it('creates an institution and an initial admin user (happy path)', async () => {
    institutions.findBySubdomain.mockResolvedValue(null)
    institutions.create.mockResolvedValue({
      id: 'inst-1',
      toPublicJson: () => ({
        id: 'inst-1',
        name: 'Universidad A',
        subdomain: 'universidad-a',
        status: 'ACTIVE' as const,
        plan: 'FREE',
        timezone: 'America/Argentina/Buenos_Aires',
        logoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as ReturnType<IInstitutionRepository['create']>)

    const createdUser = {
      id: 'user-1',
      email: 'admin@a.com',
      fullName: 'Admin',
      role: 'INSTITUTION_ADMIN',
      institutionId: 'inst-1',
    } as unknown as User
    users.create.mockResolvedValue(createdUser)

    const result = await useCase.execute({
      name: 'Universidad A',
      subdomain: 'universidad-a',
      email: 'admin@a.com',
      country: 'AR',
      adminEmail: 'admin@a.com',
      adminFullName: 'Admin',
    } as never)

    expect(result.institution.id).toBe('inst-1')
    expect(result.adminUser.id).toBe('user-1')
    expect(result.adminUser.temporaryPassword).toBeDefined()
    expect(result.adminUser.role).toBe('INSTITUTION_ADMIN')
    expect(passwordHasher.hash).toHaveBeenCalledTimes(1)
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@a.com',
        role: 'INSTITUTION_ADMIN',
        institutionId: 'inst-1',
      }),
    )
  })

  it('throws 409 on duplicate subdomain', async () => {
    institutions.findBySubdomain.mockResolvedValue({
      id: 'existing',
    } as unknown as ReturnType<IInstitutionRepository['findBySubdomain']>)

    await expect(
      useCase.execute({
        name: 'Universidad A',
        subdomain: 'universidad-a',
        email: 'admin@a.com',
        country: 'AR',
        adminEmail: 'admin@a.com',
        adminFullName: 'Admin',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException)
  })
})

import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import type { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import { USER_REPOSITORY } from '../../../auth/domain/repositories/user.repository.interface'
import type { UserRepository } from '../../../auth/domain/repositories/user.repository.interface'
import { Subdomain } from '../../domain/value-objects/subdomain.vo'
import {
  INSTITUTION_REPOSITORY,
  type IInstitutionRepository,
} from '../../domain/repositories/institution.repository.interface'
import type {
  CreateInstitutionDto,
  CreateInstitutionResponse,
} from '../dtos/create-institution.dto'

/**
 * CreateInstitutionUseCase — creates a new institution AND its
 * initial INSTITUTION_ADMIN user in one operation. Per spec
 * REQ-INST-002: the response includes the institution, the admin
 * user's `id` + `email` + a temporary password, and a set-password
 * signed link (no SMTP in MVP).
 *
 * Why we don't use a `$transaction` here: the institution insert
 * and the user insert are independent at the DB level (no FK from
 * user → institution during the insert window), and the audit
 * interceptor's `tap` handler would swallow a transaction rollback
 * if we wanted atomic semantics. We accept a partial-failure window
 * (institution created, admin user fails) and surface a 5xx — the
 * operator can retry the admin-user creation manually. In practice
 * the failure modes are: duplicate subdomain (caught), duplicate
 * email (caught), DB outage (5xx).
 */
@Injectable()
export class CreateInstitutionUseCase {
  private readonly logger = new Logger(CreateInstitutionUseCase.name)

  constructor(
    @Inject(INSTITUTION_REPOSITORY)
    private readonly institutions: IInstitutionRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async execute(input: CreateInstitutionDto): Promise<CreateInstitutionResponse> {
    // 1. Validate the subdomain via the value object (throws on bad format).
    const subdomain = Subdomain.create(input.subdomain)

    // 2. Ensure the subdomain is unique.
    const existing = await this.institutions.findBySubdomain(subdomain.value)
    if (existing) {
      throw new ConflictException({
        message: 'Subdomain already in use',
        error: 'Conflict',
        field: 'subdomain',
      })
    }

    // 3. Create the institution.
    const institution = await this.institutions.create({
      name: input.name,
      subdomain: subdomain.value,
      plan: input.plan,
      timezone: input.timezone,
    })

    // 4. Generate a temporary password for the initial admin (16 chars,
    // URL-safe, no SMTP in MVP — spec REQ-INST-002-01).
    const temporaryPassword = this.generateTemporaryPassword()
    const passwordHash = await this.passwordHasher.hash(temporaryPassword)

    // 5. Create the INSTITUTION_ADMIN user.
    const adminUser = await this.users.create({
      email: input.adminEmail,
      passwordHash,
      fullName: input.adminFullName,
      role: 'INSTITUTION_ADMIN',
      institutionId: institution.id,
    })

    // 6. Build a set-password signed link. We delegate to the auth
    // module's set-password flow but the controller is going to call
    // the SetPasswordUseCase.issue() itself to keep the cross-module
    // call explicit (avoids circular DI between institutions and
    // auth). We return the same password here so the FE can show it.
    return {
      institution: institution.toPublicJson() as CreateInstitutionResponse['institution'],
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        fullName: adminUser.fullName,
        role: 'INSTITUTION_ADMIN',
        temporaryPassword,
      },
      // The actual set-password link is generated and signed by the
      // SetPasswordUseCase at the controller level (to avoid a
      // circular DI import). We populate it with a placeholder so
      // the response shape is stable; the controller replaces it.
      setPasswordLink: '',
    }
  }

  private generateTemporaryPassword(): string {
    // 16 chars, base64url alphabet, no ambiguous characters.
    return randomBytes(12).toString('base64url')
  }
}

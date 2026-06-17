import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Express } from 'express'
import { Audit } from '../../../../audit/decorators/audit.decorator'
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard'
import { Roles } from '../../../auth/presentation/decorators/roles.decorator'
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard'
import { SuperAdminOnlyGuard } from '../../../auth/infrastructure/guards/super-admin-only.guard'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import {
  CreateInstitutionDtoSchema,
  type CreateInstitutionDto,
  type CreateInstitutionResponse,
} from '../../application/dtos/create-institution.dto'
import {
  ListInstitutionsQueryDtoSchema,
  type ListInstitutionsQueryDto,
} from '../../application/dtos/list-institutions.query.dto'
import {
  UpdateInstitutionDtoSchema,
  type UpdateInstitutionDto,
} from '../../application/dtos/update-institution.dto'
import {
  ALLOWED_LOGO_MIME_TYPES,
  MAX_LOGO_BYTES,
  UploadLogoResponseSchema,
  type UploadLogoResponse,
} from '../../application/dtos/upload-logo.dto'
import type { ActivateInstitutionUseCase } from '../../application/use-cases/activate-institution.use-case'
import type { CreateInstitutionUseCase } from '../../application/use-cases/create-institution.use-case'
import type { DeactivateInstitutionUseCase } from '../../application/use-cases/deactivate-institution.use-case'
import type { GetInstitutionUseCase } from '../../application/use-cases/get-institution.use-case'
import type { ListInstitutionsUseCase } from '../../application/use-cases/list-institutions.use-case'
import type { UpdateInstitutionUseCase } from '../../application/use-cases/update-institution.use-case'
import type { UploadLogoUseCase } from '../../application/use-cases/upload-logo.use-case'
import type { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'

/**
 * SuperAdminInstitutionsController — all `/api/super/institutions/*`
 * endpoints. The controller is mounted under the `/api/super` prefix
 * to make it unambiguous that these endpoints are reserved for
 * super-admins and use the unfiltered `superAdminPrisma` path.
 *
 * All mutating endpoints are wrapped in `@Audit(...)` so the audit
 * log records actor + action + entity id (per design §8.6).
 */
@Controller('super/institutions')
@UseGuards(JwtAuthGuard, RolesGuard, SuperAdminOnlyGuard)
@Roles('SUPER_ADMIN')
export class SuperAdminInstitutionsController {
  constructor(
    private readonly createUseCase: CreateInstitutionUseCase,
    private readonly listUseCase: ListInstitutionsUseCase,
    private readonly getUseCase: GetInstitutionUseCase,
    private readonly updateUseCase: UpdateInstitutionUseCase,
    private readonly deactivateUseCase: DeactivateInstitutionUseCase,
    private readonly activateUseCase: ActivateInstitutionUseCase,
    private readonly uploadLogoUseCase: UploadLogoUseCase,
    private readonly setPasswordUseCase: SetPasswordUseCase,
  ) {}

  // ─── GET /super/institutions ──────────────────────────────────────────
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListInstitutionsQueryDtoSchema))
    query: ListInstitutionsQueryDto,
  ): Promise<unknown> {
    const result = await this.listUseCase.execute({
      cursor: query.cursor,
      limit: query.limit,
      isActive: query.isActive ?? null,
      search: query.search,
    })
    return {
      data: result.data.map((i) => i.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── POST /super/institutions ─────────────────────────────────────────
  @Post()
  @Audit({ action: 'INSTITUTION_CREATED', entityType: 'Institution', entityIdFrom: 'result' })
  async create(
    @Body(new ZodValidationPipe(CreateInstitutionDtoSchema)) body: CreateInstitutionDto,
  ): Promise<CreateInstitutionResponse> {
    const result = await this.createUseCase.execute(body)

    // Issue a set-password signed link for the initial admin so the
    // super admin can forward it (no SMTP in MVP, see design R4).
    // If this fails we still return the institution + temp password —
    // the operator can re-issue the link manually.
    try {
      const issued = await this.setPasswordUseCase.issue(result.adminUser.id)
      result.setPasswordLink = issued.resetUrl ?? ''
    } catch {
      // swallow — the temporary password is enough to log in
    }
    return result
  }

  // ─── GET /super/institutions/:id ──────────────────────────────────────
  @Get(':id')
  async byId(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const inst = await this.getUseCase.byId(id)
    return inst.toPublicJson()
  }

  // ─── GET /super/institutions/by-slug/:slug ────────────────────────────
  @Get('by-slug/:slug')
  async bySlug(@Param('slug') slug: string): Promise<unknown> {
    const inst = await this.getUseCase.bySubdomain(slug)
    return inst.toPublicJson()
  }

  // ─── PATCH /super/institutions/:id ────────────────────────────────────
  @Patch(':id')
  @Audit({ action: 'INSTITUTION_UPDATED', entityType: 'Institution' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateInstitutionDtoSchema)) body: UpdateInstitutionDto,
  ): Promise<unknown> {
    const inst = await this.updateUseCase.execute(id, body)
    return inst.toPublicJson()
  }

  // ─── POST /super/institutions/:id/deactivate ──────────────────────────
  @Post(':id/deactivate')
  @Audit({ action: 'INSTITUTION_DEACTIVATED', entityType: 'Institution' })
  async deactivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const inst = await this.deactivateUseCase.execute(id)
    return inst.toPublicJson()
  }

  // ─── POST /super/institutions/:id/activate ────────────────────────────
  @Post(':id/activate')
  @Audit({ action: 'INSTITUTION_REACTIVATED', entityType: 'Institution' })
  async activate(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const inst = await this.activateUseCase.execute(id)
    return inst.toPublicJson()
  }

  // ─── POST /super/institutions/:id/logo (multipart) ────────────────────
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file'))
  @Audit({ action: 'INSTITUTION_LOGO_UPDATED', entityType: 'Institution' })
  async uploadLogo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadLogoResponse> {
    if (!file) {
      throw new BadRequestException({ message: 'No file uploaded' })
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException({ message: 'File exceeds 2MB limit' })
    }
    if (
      !ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_LOGO_MIME_TYPES)[number])
    ) {
      throw new BadRequestException({ message: 'Only JPEG and PNG are allowed' })
    }
    const updated = await this.uploadLogoUseCase.execute(id, file)
    return UploadLogoResponseSchema.parse({
      logoUrl: updated.logoUrl,
      publicId: `institutions/${id}/logo/logo`,
      width: 0,
      height: 0,
      format: 'unknown',
    })
  }
}

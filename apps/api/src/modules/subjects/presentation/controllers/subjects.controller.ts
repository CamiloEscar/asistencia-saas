import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { Audit } from '../../../../audit/decorators/audit.decorator'
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard'
import { Roles } from '../../../auth/presentation/decorators/roles.decorator'
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import  { CreateSubjectUseCase } from '../../application/use-cases/create-subject.use-case'
import  { ListSubjectsUseCase } from '../../application/use-cases/list-subjects.use-case'
import  { GetSubjectUseCase } from '../../application/use-cases/get-subject.use-case'
import  { UpdateSubjectUseCase } from '../../application/use-cases/update-subject.use-case'
import  { DeactivateSubjectUseCase } from '../../application/use-cases/deactivate-subject.use-case'
import {
  CreateSubjectDtoSchema,
  type CreateSubjectDto,
  type CreateSubjectResponse,
} from '../../application/dtos/create-subject.dto'
import {
  UpdateSubjectDtoSchema,
  type UpdateSubjectDto,
} from '../../application/dtos/update-subject.dto'
import {
  ListSubjectsQueryDtoSchema,
  type ListSubjectsQueryDto,
} from '../../application/dtos/list-subjects.query.dto'

/**
 * SubjectsController — `/api/subjects/*` endpoints.
 *   - GET (list + by-id): open to any authenticated user.
 *   - POST / PATCH / DELETE: ADMIN only.
 */
@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(
    private readonly createUseCase: CreateSubjectUseCase,
    private readonly listUseCase: ListSubjectsUseCase,
    private readonly getUseCase: GetSubjectUseCase,
    private readonly updateUseCase: UpdateSubjectUseCase,
    private readonly deactivateUseCase: DeactivateSubjectUseCase,
  ) {}

  // ─── GET /subjects ─────────────────────────────────────────────────────
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListSubjectsQueryDtoSchema)) query: ListSubjectsQueryDto,
  ): Promise<unknown> {
    const result = await this.listUseCase.execute({
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
    })
    return {
      data: result.data.map((s) => s.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── POST /subjects ────────────────────────────────────────────────────
  @Post()
  @Roles('ADMIN')
  @Audit({ action: 'SUBJECT_CREATED', entityType: 'Subject', entityIdFrom: 'result' })
  async create(
    @Body(new ZodValidationPipe(CreateSubjectDtoSchema)) body: CreateSubjectDto,
  ): Promise<CreateSubjectResponse> {
    return this.createUseCase.execute(body)
  }

  // ─── GET /subjects/:id ─────────────────────────────────────────────────
  @Get(':id')
  async byId(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const s = await this.getUseCase.execute(id)
    return s.toPublicJson()
  }

  // ─── PATCH /subjects/:id ───────────────────────────────────────────────
  @Patch(':id')
  @Roles('ADMIN')
  @Audit({ action: 'SUBJECT_UPDATED', entityType: 'Subject' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateSubjectDtoSchema)) body: UpdateSubjectDto,
  ): Promise<unknown> {
    const s = await this.updateUseCase.execute(id, body)
    return s.toPublicJson()
  }

  // ─── POST /subjects/:id/deactivate ─────────────────────────────────────
  @Post(':id/deactivate')
  @Roles('ADMIN')
  @Audit({ action: 'SUBJECT_DEACTIVATED', entityType: 'Subject' })
  async deactivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const s = await this.deactivateUseCase.execute(id)
    return s.toPublicJson()
  }

  // ─── DELETE /subjects/:id (alias) ──────────────────────────────────────
  @Delete(':id')
  @Roles('ADMIN')
  @Audit({ action: 'SUBJECT_DELETED', entityType: 'Subject' })
  async delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const s = await this.deactivateUseCase.execute(id)
    return s.toPublicJson()
  }
}

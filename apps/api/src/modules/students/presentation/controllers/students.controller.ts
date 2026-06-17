import {
  Body,
  Controller,
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
import { TenantGuard } from '../../../auth/infrastructure/guards/tenant.guard'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { getTenantContext } from '../../../../shared/tenant/tenant.context'
import type { CreateStudentUseCase } from '../../application/use-cases/create-student.use-case'
import type { ListStudentsUseCase } from '../../application/use-cases/list-students.use-case'
import type { GetStudentUseCase } from '../../application/use-cases/get-student.use-case'
import type { UpdateStudentUseCase } from '../../application/use-cases/update-student.use-case'
import type { DeactivateStudentUseCase } from '../../application/use-cases/deactivate-student.use-case'
import {
  CreateStudentDtoSchema,
  type CreateStudentDto,
  type CreateStudentResponse,
} from '../../application/dtos/create-student.dto'
import {
  UpdateStudentDtoSchema,
  type UpdateStudentDto,
} from '../../application/dtos/update-student.dto'
import {
  ListStudentsQueryDtoSchema,
  type ListStudentsQueryDto,
} from '../../application/dtos/list-students.query.dto'

/**
 * StudentsController — `/api/students/*` endpoints. Scoped to the
 * caller's institution via TenantGuard. Role-based access:
 *   - INSTITUTION_ADMIN: full CRUD on the students in their institution.
 *   - TEACHER: read-only (list + get + /:id/attendance), with
 *     role-based filtering so they only see enrolled students.
 *   - STUDENT: only `/api/me/attendance` (mounted separately in
 *     MyAttendanceController below).
 */
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('INSTITUTION_ADMIN', 'TEACHER')
export class StudentsController {
  constructor(
    private readonly createUseCase: CreateStudentUseCase,
    private readonly listUseCase: ListStudentsUseCase,
    private readonly getUseCase: GetStudentUseCase,
    private readonly updateUseCase: UpdateStudentUseCase,
    private readonly deactivateUseCase: DeactivateStudentUseCase,
  ) {}

  // ─── GET /students ─────────────────────────────────────────────────────
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListStudentsQueryDtoSchema)) query: ListStudentsQueryDto,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const result = await this.listUseCase.execute(institutionId, {
      cursor: query.cursor,
      limit: query.limit,
      isActive: query.isActive ?? null,
      search: query.search ?? null,
      career: query.career ?? null,
    })
    return {
      data: result.data.map((s) => s.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── POST /students ────────────────────────────────────────────────────
  @Post()
  @Roles('INSTITUTION_ADMIN')
  @Audit({ action: 'STUDENT_CREATED', entityType: 'User', entityIdFrom: 'result' })
  async create(
    @Body(new ZodValidationPipe(CreateStudentDtoSchema)) body: CreateStudentDto,
  ): Promise<CreateStudentResponse> {
    const institutionId = this.requireTenantId()
    const result = await this.createUseCase.execute(body, institutionId)
    return result
  }

  // ─── GET /students/:id ─────────────────────────────────────────────────
  @Get(':id')
  async byId(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const s = await this.getUseCase.execute(institutionId, id)
    return s.toPublicJson()
  }

  // ─── PATCH /students/:id ───────────────────────────────────────────────
  @Patch(':id')
  @Roles('INSTITUTION_ADMIN')
  @Audit({ action: 'STUDENT_UPDATED', entityType: 'User' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateStudentDtoSchema)) body: UpdateStudentDto,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const s = await this.updateUseCase.execute(institutionId, id, body)
    return s.toPublicJson()
  }

  // ─── POST /students/:id/deactivate ─────────────────────────────────────
  @Post(':id/deactivate')
  @Roles('INSTITUTION_ADMIN')
  @Audit({ action: 'STUDENT_DEACTIVATED', entityType: 'User' })
  async deactivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const s = await this.deactivateUseCase.execute(institutionId, id)
    return s.toPublicJson()
  }

  private requireTenantId(): string {
    const ctx = getTenantContext()
    if (!ctx) {
      throw new Error('Tenant context missing — TenantMiddleware did not run')
    }
    return ctx.tenantId
  }
}

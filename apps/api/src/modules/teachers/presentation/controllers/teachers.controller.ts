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
import { TenantGuard } from '../../../auth/infrastructure/guards/tenant.guard'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator'
import type { TokenClaims } from '../../../../shared/crypto/jwt.service'
import { getTenantContext } from '../../../../shared/tenant/tenant.context'
import type { CreateTeacherUseCase } from '../../application/use-cases/create-teacher.use-case'
import type { ListTeachersUseCase } from '../../application/use-cases/list-teachers.use-case'
import type { GetTeacherUseCase } from '../../application/use-cases/get-teacher.use-case'
import type { UpdateTeacherUseCase } from '../../application/use-cases/update-teacher.use-case'
import type { DeactivateTeacherUseCase } from '../../application/use-cases/deactivate-teacher.use-case'
import { CreateTeacherDtoSchema, type CreateTeacherDto, type CreateTeacherResponse } from '../../application/dtos/create-teacher.dto'
import { UpdateTeacherDtoSchema, type UpdateTeacherDto } from '../../application/dtos/update-teacher.dto'
import { ListTeachersQueryDtoSchema, type ListTeachersQueryDto } from '../../application/dtos/list-teachers.query.dto'

/**
 * TeachersController — `/api/teachers/*` endpoints + `/api/teachers/me/courses`.
 *
 *   - GET/POST/PATCH/DELETE on `/api/teachers` are INSTITUTION_ADMIN only.
 *   - GET `/api/me/courses` (mounted separately) is TEACHER only.
 */
@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('INSTITUTION_ADMIN')
export class TeachersController {
  constructor(
    private readonly createUseCase: CreateTeacherUseCase,
    private readonly listUseCase: ListTeachersUseCase,
    private readonly getUseCase: GetTeacherUseCase,
    private readonly updateUseCase: UpdateTeacherUseCase,
    private readonly deactivateUseCase: DeactivateTeacherUseCase,
  ) {}

  // ─── GET /teachers ─────────────────────────────────────────────────────
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListTeachersQueryDtoSchema)) query: ListTeachersQueryDto,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const result = await this.listUseCase.execute(institutionId, {
      cursor: query.cursor,
      limit: query.limit,
      isActive: query.isActive ?? null,
      search: query.search,
    })
    return {
      data: result.data.map((t) => t.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── POST /teachers ────────────────────────────────────────────────────
  @Post()
  @Audit({ action: 'TEACHER_CREATED', entityType: 'User', entityIdFrom: 'result' })
  async create(
    @Body(new ZodValidationPipe(CreateTeacherDtoSchema)) body: CreateTeacherDto,
  ): Promise<CreateTeacherResponse> {
    const institutionId = this.requireTenantId()
    const result = await this.createUseCase.execute(body, institutionId)
    return {
      teacher: result.teacher.toPublicJson(),
      ...(result.temporaryPassword ? { temporaryPassword: result.temporaryPassword } : {}),
      ...(result.setPasswordLink ? { setPasswordLink: result.setPasswordLink } : {}),
    }
  }

  // ─── GET /teachers/:id ─────────────────────────────────────────────────
  @Get(':id')
  async byId(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const t = await this.getUseCase.execute(institutionId, id)
    return t.toPublicJson()
  }

  // ─── PATCH /teachers/:id ───────────────────────────────────────────────
  @Patch(':id')
  @Audit({ action: 'TEACHER_UPDATED', entityType: 'User' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateTeacherDtoSchema)) body: UpdateTeacherDto,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const t = await this.updateUseCase.execute(institutionId, id, body)
    return t.toPublicJson()
  }

  // ─── POST /teachers/:id/deactivate ─────────────────────────────────────
  @Post(':id/deactivate')
  @Audit({ action: 'TEACHER_DEACTIVATED', entityType: 'User' })
  async deactivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const t = await this.deactivateUseCase.execute(institutionId, id)
    return t.toPublicJson()
  }

  // ─── DELETE /teachers/:id (alias) ──────────────────────────────────────
  @Delete(':id')
  @Audit({ action: 'TEACHER_DELETED', entityType: 'User' })
  async delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const t = await this.deactivateUseCase.execute(institutionId, id)
    return t.toPublicJson()
  }

  private requireTenantId(): string {
    const ctx = getTenantContext()
    if (!ctx) {
      throw new Error('Tenant context missing — TenantMiddleware did not run')
    }
    return ctx.tenantId
  }
}

/**
 * MyCoursesController — `/api/me/courses` for the authenticated
 * TEACHER. Returns the courses the caller is assigned to in the
 * current active semester, ordered by next session.
 *
 * Per spec REQ-TEACHER-005-03, this endpoint is forbidden to
 * STUDENT/ADMIN — only TEACHER can call it. The @Roles decorator
 * enforces that; the global RolesGuard returns 403 otherwise.
 */
@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('TEACHER')
export class MyCoursesController {
  // The full implementation lands in Phase 10 (courses module)
  // when the course_teachers table is in scope. For now we return
  // a placeholder shape so the route is wired and discoverable.
  @Get('courses')
  myCourses(@CurrentUser() _user: TokenClaims): Promise<{ data: unknown[]; nextCursor: null }> {
    return Promise.resolve({ data: [], nextCursor: null })
  }
}

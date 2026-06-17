import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common'
import { Audit } from '../../../../audit/decorators/audit.decorator'
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard'
import { Roles } from '../../../auth/presentation/decorators/roles.decorator'
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard'
import { TenantGuard } from '../../../auth/infrastructure/guards/tenant.guard'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { getTenantContext } from '../../../../shared/tenant/tenant.context'
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator'
import type { TokenClaims } from '../../../../shared/crypto/jwt.service'
import type { MarkAttendanceUseCase } from '../../application/use-cases/mark-attendance.use-case'
import type { ModifyAttendanceUseCase } from '../../application/use-cases/modify-attendance.use-case'
import type { ListAttendanceUseCase } from '../../application/use-cases/list-attendance.use-case'
import type { AttendanceSummaryUseCase } from '../../application/use-cases/attendance-summary.use-case'
import type { GetAttendanceUseCase } from '../../application/use-cases/get-attendance.use-case'
import {
  MarkAttendanceDtoSchema,
  type MarkAttendanceDto,
} from '../../application/dtos/mark-attendance.dto'
import {
  ModifyAttendanceDtoSchema,
  type ModifyAttendanceDto,
} from '../../application/dtos/modify-attendance.dto'
import {
  ListAttendanceQueryDtoSchema,
  type ListAttendanceQueryDto,
} from '../../application/dtos/list-attendance.query.dto'
import {
  AttendanceSummaryQueryDtoSchema,
  type AttendanceSummaryQueryDto,
} from '../../application/dtos/attendance-summary.query.dto'

/**
 * AttendanceController — `/api/attendance/*` endpoints. The
 * "core" of the product: teachers mark attendance, admins
 * modify / summarize, students view their own history.
 *
 * Endpoints:
 *   POST   /api/attendance              — bulk mark (TEACHER / ADMIN)
 *   GET    /api/attendance              — list (role-filtered)
 *   GET    /api/attendance/summary      — summary by course/student/teacher
 *   GET    /api/attendance/me/attendance — student's own list
 *   GET    /api/attendance/me/summary   — student's own summary
 *   GET    /api/attendance/:id          — single record (TEACHER / ADMIN)
 *   PATCH  /api/attendance/:id          — modify (TEACHER same-day, ADMIN any)
 *   POST   /api/attendance/:id/evidence — upload evidence image (TEACHER)
 *
 * Note: `:id` for GET / PATCH and `/summary` for GET live in the
 * same controller; Nest's router matches `/summary` first
 * because static routes take precedence over params.
 */
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class AttendanceController {
  constructor(
    private readonly markUseCase: MarkAttendanceUseCase,
    private readonly modifyUseCase: ModifyAttendanceUseCase,
    private readonly listUseCase: ListAttendanceUseCase,
    private readonly summaryUseCase: AttendanceSummaryUseCase,
    private readonly getUseCase: GetAttendanceUseCase,
  ) {}

  // ─── POST /attendance (bulk mark) ────────────────────────────────────
  @Post()
  @Roles('TEACHER', 'INSTITUTION_ADMIN', 'SUPER_ADMIN')
  @Audit({ action: 'ATTENDANCE_MARKED', entityType: 'ClassSession' })
  async mark(
    @Body(new ZodValidationPipe(MarkAttendanceDtoSchema)) body: MarkAttendanceDto,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const result = await this.markUseCase.execute(body, {
      institutionId,
      actorUserId: user.sub,
      actorRole: user.role,
    })
    return {
      sessionId: result.sessionId,
      markedCount: result.created + result.updated,
      created: result.created,
      updated: result.updated,
      presentCount: result.presentCount,
      absentCount: result.absentCount,
      lateCount: result.lateCount,
      justifiedCount: result.justifiedCount,
    }
  }

  // ─── GET /attendance (list) ──────────────────────────────────────────
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListAttendanceQueryDtoSchema)) query: ListAttendanceQueryDto,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const result = await this.listUseCase.execute(query, institutionId)
    return {
      data: result.data.map((a) => a.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── GET /attendance/summary (by course/student/teacher) ─────────────
  // NOTE: must be declared BEFORE `:id` to win the static-vs-param
  // route ordering. NestJS uses first-match wins.
  @Get('summary')
  @Roles('TEACHER', 'INSTITUTION_ADMIN', 'SUPER_ADMIN')
  async summary(
    @Query(new ZodValidationPipe(AttendanceSummaryQueryDtoSchema)) query: AttendanceSummaryQueryDto,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const result = await this.summaryUseCase.executeFromQuery(query, institutionId)
    return result
  }

  // ─── GET /attendance/me/attendance (student's own list) ─────────────
  @Get('me/attendance')
  @Roles('STUDENT')
  async myAttendance(
    @Query(new ZodValidationPipe(ListAttendanceQueryDtoSchema)) query: ListAttendanceQueryDto,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const ctx = getTenantContext()
    const studentId = ctx?.userId
    if (!studentId) {
      throw new NotFoundException({ message: 'Student identity missing' })
    }
    const result = await this.listUseCase.execute({ ...query, studentId }, institutionId)
    return {
      data: result.data.map((a) => a.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── GET /attendance/me/summary (student's own summary) ────────────
  @Get('me/summary')
  @Roles('STUDENT')
  async mySummary(
    @Query(new ZodValidationPipe(AttendanceSummaryQueryDtoSchema)) query: AttendanceSummaryQueryDto,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const ctx = getTenantContext()
    const studentId = ctx?.userId
    if (!studentId) {
      throw new NotFoundException({ message: 'Student identity missing' })
    }
    return this.summaryUseCase.executeStudent(institutionId, studentId, query.studentCourseId)
  }

  // ─── GET /attendance/:id (single record) ─────────────────────────────
  @Get(':id')
  async byId(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const record = await this.getUseCase.execute(id, {
      institutionId,
      actorUserId: user.sub,
      actorRole: user.role,
    })
    return record.toPublicJson()
  }

  // ─── PATCH /attendance/:id (modify) ──────────────────────────────────
  @Patch(':id')
  @Roles('TEACHER', 'INSTITUTION_ADMIN', 'SUPER_ADMIN')
  @Audit({ action: 'ATTENDANCE_MODIFIED', entityType: 'AttendanceRecord' })
  async modify(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ModifyAttendanceDtoSchema)) body: ModifyAttendanceDto,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    const institutionId = this.requireTenantId()
    const updated = await this.modifyUseCase.execute(id, body, {
      institutionId,
      actorUserId: user.sub,
      actorRole: user.role,
    })
    return updated.toPublicJson()
  }

  private requireTenantId(): string {
    const ctx = getTenantContext()
    if (!ctx) {
      throw new Error('Tenant context missing — TenantMiddleware did not run')
    }
    return ctx.tenantId
  }
}

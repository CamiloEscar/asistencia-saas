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
import type { TokenClaims } from '../../../../shared/crypto/jwt.service'
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator'
import  { CreateUserUseCase } from '../../application/use-cases/create-user.use-case'
import  { ListUsersUseCase } from '../../application/use-cases/list-users.use-case'
import  { GetUserUseCase } from '../../application/use-cases/get-user.use-case'
import  { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case'
import  { DeactivateUserUseCase } from '../../application/use-cases/deactivate-user.use-case'
import  { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case'
import {
  CreateUserDtoSchema,
  type CreateUserDto,
  type CreateUserResponse,
} from '../../application/dtos/create-user.dto'
import { UpdateUserDtoSchema, type UpdateUserDto } from '../../application/dtos/update-user.dto'
import {
  ListUsersQueryDtoSchema,
  type ListUsersQueryDto,
} from '../../application/dtos/list-users.query.dto'

/**
 * UsersController — `/api/users/*` endpoints. ADMIN can manage all
 * users. TEACHER and STUDENT do not have a `/api/users` management
 * surface (the spec routes them through `/api/me` for self-service).
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(
    private readonly createUseCase: CreateUserUseCase,
    private readonly listUseCase: ListUsersUseCase,
    private readonly getUseCase: GetUserUseCase,
    private readonly updateUseCase: UpdateUserUseCase,
    private readonly deactivateUseCase: DeactivateUserUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  // ─── GET /users ────────────────────────────────────────────────────────
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListUsersQueryDtoSchema)) query: ListUsersQueryDto,
  ): Promise<unknown> {
    const result = await this.listUseCase.execute({
      cursor: query.cursor,
      limit: query.limit,
      role: query.role ?? null,
      isActive: query.isActive ?? null,
      search: query.search,
    })
    return {
      data: result.data.map((u) => u.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── POST /users ───────────────────────────────────────────────────────
  @Post()
  @Audit({ action: 'USER_CREATED', entityType: 'User', entityIdFrom: 'result' })
  create(
    @Body(new ZodValidationPipe(CreateUserDtoSchema)) body: CreateUserDto,
  ): Promise<CreateUserResponse> {
    return this.createUseCase.execute(body)
  }

  // ─── GET /users/:id ────────────────────────────────────────────────────
  @Get(':id')
  async byId(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const u = await this.getUseCase.execute(id)
    return u.toPublicJson()
  }

  // ─── PATCH /users/:id ──────────────────────────────────────────────────
  @Patch(':id')
  @Audit({ action: 'USER_UPDATED', entityType: 'User' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateUserDtoSchema)) body: UpdateUserDto,
    @CurrentUser() actor: TokenClaims,
  ): Promise<unknown> {
    const u = await this.updateUseCase.execute(actor.sub, id, body)
    return u.toPublicJson()
  }

  // ─── POST /users/:id/deactivate ────────────────────────────────────────
  @Post(':id/deactivate')
  @Audit({ action: 'USER_DEACTIVATED', entityType: 'User' })
  async deactivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const u = await this.deactivateUseCase.execute(id)
    return u.toPublicJson()
  }

  // ─── DELETE /users/:id (alias of deactivate, spec REQ-USER-005) ───────
  @Delete(':id')
  @Audit({ action: 'USER_DELETED', entityType: 'User' })
  async delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const u = await this.deactivateUseCase.execute(id)
    return u.toPublicJson()
  }

  // ─── POST /users/:id/reset-password ────────────────────────────────────
  @Post(':id/reset-password')
  @Audit({ action: 'PASSWORD_RESET_BY_ADMIN', entityType: 'User' })
  async resetPassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: TokenClaims,
  ): Promise<unknown> {
    return this.resetPasswordUseCase.execute(actor.sub, id)
  }
}

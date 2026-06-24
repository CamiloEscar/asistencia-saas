import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CryptoModule } from '../../shared/crypto/crypto.module'
import { PrismaModule } from '../../shared/prisma/prisma.module'
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard'
import { CreateUserUseCase } from './application/use-cases/create-user.use-case'
import { ListUsersUseCase } from './application/use-cases/list-users.use-case'
import { GetUserUseCase } from './application/use-cases/get-user.use-case'
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case'
import { DeactivateUserUseCase } from './application/use-cases/deactivate-user.use-case'
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case'
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface'
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository'
import { UsersController } from './presentation/controllers/users.controller'

/**
 * UsersModule — user management.
 *
 * Cross-cutting dependencies:
 *   - `AuthModule` — for `SetPasswordUseCase` (issue activation
 *     links during user creation / password reset) and the auth
 *     guards (JwtAuthGuard, RolesGuard).
 *   - `PrismaModule` — for the Prisma client.
 *   - `CryptoModule` — for the password hasher.
 */
@Module({
  imports: [PrismaModule, CryptoModule, AuthModule],
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    CreateUserUseCase,
    ListUsersUseCase,
    GetUserUseCase,
    UpdateUserUseCase,
    DeactivateUserUseCase,
    ResetPasswordUseCase,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}

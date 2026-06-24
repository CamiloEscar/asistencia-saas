import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { TerminusModule } from '@nestjs/terminus'
import Redis from 'ioredis'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { TeachersModule } from './modules/teachers/teachers.module'
import { StudentsModule } from './modules/students/students.module'
import { SubjectsModule } from './modules/subjects/subjects.module'
import { CoursesModule } from './modules/courses/courses.module'
import { AttendanceModule } from './modules/attendance/attendance.module'
import { AppConfigModule } from './modules/app-config/app-config.module'
import { CsvModule } from './shared/csv/csv.module'
import { QueueModule } from './shared/queue/queue.module'
import { CloudinaryModule } from './shared/cloudinary/cloudinary.module'
import { JwtAuthGuard } from './modules/auth/infrastructure/guards/jwt-auth.guard'
import { RolesGuard } from './modules/auth/infrastructure/guards/roles.guard'
import { HttpExceptionFilter } from './shared/filters/http-exception.filter'
import { ZodValidationPipe } from './shared/pipes/zod-validation.pipe'
import { envSchema } from './shared/config/env.schema'
import { PrismaModule } from './shared/prisma/prisma.module'
import { RedisModule } from './shared/redis/redis.module'
import { AppLoggerModule } from './shared/logger/logger.module'
import { AuditModule } from './audit/audit.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => envSchema.parse(raw),
    }),
    PrismaModule,
    RedisModule,
    AppLoggerModule,
    AuditModule,
    AuthModule,
    UsersModule,
    TeachersModule,
    StudentsModule,
    SubjectsModule,
    CoursesModule,
    AttendanceModule,
    AppConfigModule,
    CsvModule,
    QueueModule,
    CloudinaryModule,
    TerminusModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
        const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 })
        return {
          throttlers: [
            {
              ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
              limit: Number(process.env.THROTTLE_LIMIT ?? 100),
            },
          ],
          storage: new ThrottlerStorageRedisService(client),
        }
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

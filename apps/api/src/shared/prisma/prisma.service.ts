import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  private readonly client: PrismaClient

  constructor() {
    this.client = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn', 'info'],
    })
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect()
    this.logger.log('Prisma connected')
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect()
  }

  get $connect(): PrismaClient['$connect'] {
    return this.client.$connect.bind(this.client)
  }
  get $disconnect(): PrismaClient['$disconnect'] {
    return this.client.$disconnect.bind(this.client)
  }
  get $transaction(): PrismaClient['$transaction'] {
    return this.client.$transaction.bind(this.client)
  }
  get $queryRaw(): PrismaClient['$queryRaw'] {
    return this.client.$queryRaw.bind(this.client)
  }
  get $executeRaw(): PrismaClient['$executeRaw'] {
    return this.client.$executeRaw.bind(this.client)
  }

  get appConfig(): PrismaClient['appConfig'] {
    return this.client.appConfig
  }
  get user(): PrismaClient['user'] {
    return this.client.user
  }
  get subject(): PrismaClient['subject'] {
    return this.client.subject
  }
  get course(): PrismaClient['course'] {
    return this.client.course
  }
  get courseTeacher(): PrismaClient['courseTeacher'] {
    return this.client.courseTeacher
  }
  get enrollment(): PrismaClient['enrollment'] {
    return this.client.enrollment
  }
  get classSession(): PrismaClient['classSession'] {
    return this.client.classSession
  }
  get attendanceRecord(): PrismaClient['attendanceRecord'] {
    return this.client.attendanceRecord
  }
  get refreshToken(): PrismaClient['refreshToken'] {
    return this.client.refreshToken
  }
  get auditLog(): PrismaClient['auditLog'] {
    return this.client.auditLog
  }
}

export { Prisma }

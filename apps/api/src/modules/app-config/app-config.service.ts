import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../shared/prisma/prisma.service'

@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return this.prisma.appConfig.findFirst()
  }
}

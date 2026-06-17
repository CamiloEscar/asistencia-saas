import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly startedAt = new Date();

  getHealth() {
    return {
      status: 'ok',
      service: 'asistencia-api',
      version: process.env.npm_package_version ?? '0.0.0',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV ?? 'development',
    };
  }
}

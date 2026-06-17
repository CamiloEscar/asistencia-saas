import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './interceptors/audit.interceptor';

@Global()
@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [],
})
export class AuditModule {}

export { Audit, AUDIT_METADATA_KEY, type AuditMetadata } from './decorators/audit.decorator';
export { AuditInterceptor } from './interceptors/audit.interceptor';

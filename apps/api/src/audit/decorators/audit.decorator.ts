import { SetMetadata } from '@nestjs/common';

/**
 * `@Audit({ action, entityType })` — marks a controller method as auditable.
 * The `AuditInterceptor` reads this metadata and writes an `audit_log` row
 * after the response is sent.
 *
 * - `action`: short verb in SCREAMING_SNAKE_CASE (e.g. `USER_CREATED`).
 * - `entityType`: model name in PascalCase (e.g. `User`, `Institution`).
 * - `entityIdFrom`: `'param' | 'body' | 'result' | 'static'` — where to find
 *    the entity id. Defaults to `'param'`, looking for `:id` in the route.
 * - `entityIdParam`: param name when `entityIdFrom === 'param'`. Default `'id'`.
 * - `entityIdField`: field on the response when `entityIdFrom === 'result'`. Default `'id'`.
 *
 * Examples:
 *   @Audit({ action: 'USER_CREATED', entityType: 'User' })
 *   @Audit({ action: 'INSTITUTION_DEACTIVATED', entityType: 'Institution', entityIdFrom: 'param' })
 *   @Audit({ action: 'ATTENDANCE_RECORDED', entityType: 'AttendanceRecord', entityIdFrom: 'result' })
 */
export interface AuditMetadata {
  action: string;
  entityType: string;
  entityIdFrom?: 'param' | 'body' | 'result' | 'static';
  entityIdParam?: string;
  entityIdField?: string;
  entityIdStatic?: string;
}

export const AUDIT_METADATA_KEY = 'audit:metadata';

export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_METADATA_KEY, metadata);

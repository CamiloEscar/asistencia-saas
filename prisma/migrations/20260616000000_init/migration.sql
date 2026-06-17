-- ────────────────────────────────────────────────────────────────────────
-- Initial migration for asistencia-saas (Hito 1 / attendance-mvp).
--
-- Creates:  extensions, enums, all 10 tables, indexes, two DB roles,
--          Row-Level Security policies, and range partitions on
--          attendance_records for 2025 / 2026 / 2027.
--
-- Apply with:  pnpm prisma migrate deploy
-- Rollback:    DROP all objects (manual; see prisma/rls-policies.sql).
-- ────────────────────────────────────────────────────────────────────────

-- ─── Extensions ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Enums ───────────────────────────────────────────────────────────────
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "UserStatus"         AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "UserRole"           AS ENUM ('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'TEACHER', 'STUDENT');
CREATE TYPE "AttendanceStatus"   AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED');
CREATE TYPE "SessionStatus"      AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "RefreshTokenStatus" AS ENUM ('active', 'used', 'revoked');

-- ─── Roles (idempotent; created in a DO block so re-runs don't fail) ─────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- ─── Helper: read current tenant from GUC ────────────────────────────────
CREATE OR REPLACE FUNCTION current_institution_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_institution_id', true), '')::uuid;
$$;

-- ─── Tables ──────────────────────────────────────────────────────────────

CREATE TABLE "institutions" (
  "id"         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       varchar(200)  NOT NULL,
  "subdomain"  varchar(63)   NOT NULL UNIQUE,
  "status"     "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
  "plan"       varchar(50)   NOT NULL DEFAULT 'FREE',
  "timezone"   varchar(100)  NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  "logoUrl"    text,
  "createdAt"  timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz(6) NOT NULL DEFAULT now(),
  "deletedAt"  timestamptz(6)
);
CREATE INDEX "institutions_status_idx"     ON "institutions" ("status");
CREATE INDEX "institutions_deletedAt_idx"  ON "institutions" ("deletedAt");

CREATE TABLE "users" (
  "id"            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "institutionId" uuid,  -- null for SUPER_ADMIN
  "email"         citext       NOT NULL,
  "passwordHash"  text,
  "fullName"      varchar(200) NOT NULL,
  "role"          "UserRole"   NOT NULL,
  "status"        "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "legajo"        varchar(20),
  "phone"         varchar(30),
  "birthDate"     date,
  "career"        varchar(100),
  "createdAt"     timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz(6) NOT NULL DEFAULT now(),
  "deletedAt"     timestamptz(6),
  CONSTRAINT "users_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT
);
-- Email unique per institution. For SUPER_ADMIN (NULL institutionId), the
-- composite allows multiple NULLs but the second unique with COALESCE on
-- institutionId would be too complex; rely on app-level invariant + check
-- in registration use case.
CREATE UNIQUE INDEX "users_institutionId_email_key" ON "users" ("institutionId", "email");
CREATE UNIQUE INDEX "users_institutionId_legajo_key" ON "users" ("institutionId", "legajo");
CREATE INDEX "users_institutionId_role_idx"       ON "users" ("institutionId", "role");
CREATE INDEX "users_institutionId_status_idx"     ON "users" ("institutionId", "status");
CREATE INDEX "users_institutionId_fullName_idx"   ON "users" ("institutionId", "fullName");
CREATE INDEX "users_institutionId_deletedAt_idx"  ON "users" ("institutionId", "deletedAt");

CREATE TABLE "subjects" (
  "id"            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "institutionId" uuid         NOT NULL,
  "code"          varchar(20)  NOT NULL,
  "name"          varchar(200) NOT NULL,
  "description"   text,
  "createdAt"     timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz(6) NOT NULL DEFAULT now(),
  "deletedAt"     timestamptz(6),
  CONSTRAINT "subjects_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "subjects_institutionId_code_key" ON "subjects" ("institutionId", "code");
CREATE INDEX "subjects_institutionId_deletedAt_idx"  ON "subjects" ("institutionId", "deletedAt");

CREATE TABLE "courses" (
  "id"                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "institutionId"             uuid         NOT NULL,
  "subjectId"                 uuid         NOT NULL,
  "code"                      varchar(20)  NOT NULL,
  "name"                      varchar(200) NOT NULL,
  "description"               text,
  "semester"                  varchar(20)  NOT NULL,
  "startDate"                 date         NOT NULL,
  "endDate"                   date         NOT NULL,
  "schedule"                  jsonb        NOT NULL,
  "defaultSessionDurationMin" integer      NOT NULL DEFAULT 80,
  "createdAt"                 timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt"                 timestamptz(6) NOT NULL DEFAULT now(),
  "deletedAt"                 timestamptz(6),
  CONSTRAINT "courses_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT,
  CONSTRAINT "courses_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "courses_institutionId_code_key" ON "courses" ("institutionId", "code");
CREATE INDEX "courses_institutionId_semester_idx"   ON "courses" ("institutionId", "semester");
CREATE INDEX "courses_institutionId_subjectId_idx"  ON "courses" ("institutionId", "subjectId");
CREATE INDEX "courses_institutionId_deletedAt_idx"  ON "courses" ("institutionId", "deletedAt");

CREATE TABLE "course_teachers" (
  "id"            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "institutionId" uuid         NOT NULL,
  "courseId"      uuid         NOT NULL,
  "teacherId"     uuid         NOT NULL,
  "createdAt"     timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "course_teachers_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE,
  CONSTRAINT "course_teachers_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "course_teachers_courseId_teacherId_key" ON "course_teachers" ("courseId", "teacherId");
CREATE INDEX "course_teachers_institutionId_teacherId_idx" ON "course_teachers" ("institutionId", "teacherId");
CREATE INDEX "course_teachers_courseId_idx"                ON "course_teachers" ("courseId");

CREATE TABLE "enrollments" (
  "id"            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "institutionId" uuid         NOT NULL,
  "courseId"      uuid         NOT NULL,
  "studentId"     uuid         NOT NULL,
  "enrolledAt"    timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "enrollments_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE,
  CONSTRAINT "enrollments_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "enrollments_courseId_studentId_key" ON "enrollments" ("courseId", "studentId");
CREATE INDEX "enrollments_institutionId_studentId_idx"  ON "enrollments" ("institutionId", "studentId");
CREATE INDEX "enrollments_courseId_idx"                 ON "enrollments" ("courseId");

CREATE TABLE "class_sessions" (
  "id"            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "institutionId" uuid         NOT NULL,
  "courseId"      uuid         NOT NULL,
  "scheduledAt"   timestamptz(6) NOT NULL,
  "durationMin"   integer      NOT NULL,
  "topic"         varchar(500),
  "status"        "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdBy"     uuid         NOT NULL,
  "createdAt"     timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "class_sessions_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "class_sessions_courseId_scheduledAt_key" ON "class_sessions" ("courseId", "scheduledAt");
CREATE INDEX "class_sessions_institutionId_scheduledAt_idx"  ON "class_sessions" ("institutionId", "scheduledAt" DESC);
CREATE INDEX "class_sessions_institutionId_status_scheduledAt_idx"
  ON "class_sessions" ("institutionId", "status", "scheduledAt" DESC);

-- attendance_records as a partitioned table by RANGE on recordedAt.
-- Default partition catches anything outside the explicit yearly partitions.
CREATE TABLE "attendance_records" (
  "id"                uuid         NOT NULL DEFAULT gen_random_uuid(),
  "institutionId"     uuid         NOT NULL,
  "sessionId"         uuid         NOT NULL,
  "studentId"         uuid         NOT NULL,
  "status"            "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "justificationText" varchar(500),
  "recordedBy"        uuid         NOT NULL,
  "recordedAt"        timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id", "recordedAt"),
  CONSTRAINT "attendance_records_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "class_sessions"("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_records_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT
) PARTITION BY RANGE ("recordedAt");

-- Yearly partitions for 2025, 2026, 2027. Add more yearly (Phase 19+ cron).
CREATE TABLE "attendance_records_2025" PARTITION OF "attendance_records"
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE "attendance_records_2026" PARTITION OF "attendance_records"
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE "attendance_records_2027" PARTITION OF "attendance_records"
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
-- Catch-all for out-of-range rows (tests, backfills, far-future entries).
CREATE TABLE "attendance_records_default" PARTITION OF "attendance_records" DEFAULT;

-- Unique constraint on (sessionId, studentId) must include the partition key.
CREATE UNIQUE INDEX "attendance_records_sessionId_studentId_key"
  ON "attendance_records" ("sessionId", "studentId", "recordedAt");
CREATE INDEX "attendance_records_institutionId_studentId_recordedAt_idx"
  ON "attendance_records" ("institutionId", "studentId", "recordedAt" DESC);
CREATE INDEX "attendance_records_institutionId_recordedAt_idx"
  ON "attendance_records" ("institutionId", "recordedAt" DESC);
CREATE INDEX "attendance_records_sessionId_idx"
  ON "attendance_records" ("sessionId");

CREATE TABLE "refresh_tokens" (
  "id"        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    uuid         NOT NULL,
  "jti"       varchar(64)  NOT NULL UNIQUE,
  "familyId"  uuid         NOT NULL,
  "status"    "RefreshTokenStatus" NOT NULL DEFAULT 'active',
  "issuedAt"  timestamptz(6) NOT NULL DEFAULT now(),
  "expiresAt" timestamptz(6) NOT NULL,
  "revokedAt" timestamptz(6),
  "userAgent" text,
  "ipAddress" inet,
  CONSTRAINT "refresh_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "refresh_tokens_userId_status_idx" ON "refresh_tokens" ("userId", "status");
CREATE INDEX "refresh_tokens_familyId_idx"      ON "refresh_tokens" ("familyId");
CREATE INDEX "refresh_tokens_expiresAt_idx"     ON "refresh_tokens" ("expiresAt");

CREATE TABLE "audit_log" (
  "id"            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "institutionId" uuid,  -- null for super-admin global actions
  "actorUserId"   uuid,
  "action"        varchar(100) NOT NULL,
  "entityType"    varchar(50)  NOT NULL,
  "entityId"      uuid,
  "beforeJson"    jsonb,
  "afterJson"     jsonb,
  "ipAddress"     inet,
  "userAgent"     text,
  "requestId"     uuid,
  "createdAt"     timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL,
  CONSTRAINT "audit_log_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "audit_log_institutionId_createdAt_idx"  ON "audit_log" ("institutionId", "createdAt" DESC);
CREATE INDEX "audit_log_entityType_entityId_idx"      ON "audit_log" ("entityType", "entityId");
CREATE INDEX "audit_log_actorUserId_createdAt_idx"    ON "audit_log" ("actorUserId", "createdAt" DESC);
CREATE INDEX "audit_log_action_createdAt_idx"         ON "audit_log" ("action", "createdAt" DESC);

-- ─── Row-Level Security ───────────────────────────────────────────────────

-- Enable RLS on every tenant-scoped table. FORCE ensures even the table owner
-- is subject to policies.
ALTER TABLE "users"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"             FORCE  ROW LEVEL SECURITY;
ALTER TABLE "subjects"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subjects"          FORCE  ROW LEVEL SECURITY;
ALTER TABLE "courses"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courses"           FORCE  ROW LEVEL SECURITY;
ALTER TABLE "course_teachers"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_teachers"   FORCE  ROW LEVEL SECURITY;
ALTER TABLE "enrollments"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollments"       FORCE  ROW LEVEL SECURITY;
ALTER TABLE "class_sessions"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_sessions"    FORCE  ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "audit_log"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log"         FORCE  ROW LEVEL SECURITY;

-- Policies. Template: USING (institution_id = current_institution_id()) WITH CHECK (...).
-- audit_log allows NULL institutionId (super-admin global actions) so the policy
-- also allows NULL.
CREATE POLICY tenant_isolation_users ON "users"
  USING ("institutionId" IS NULL OR "institutionId" = current_institution_id())
  WITH CHECK ("institutionId" IS NULL OR "institutionId" = current_institution_id());

CREATE POLICY tenant_isolation_subjects ON "subjects"
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

CREATE POLICY tenant_isolation_courses ON "courses"
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

CREATE POLICY tenant_isolation_course_teachers ON "course_teachers"
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

CREATE POLICY tenant_isolation_enrollments ON "enrollments"
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

CREATE POLICY tenant_isolation_class_sessions ON "class_sessions"
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

CREATE POLICY tenant_isolation_attendance_records ON "attendance_records"
  USING ("institutionId" = current_institution_id())
  WITH CHECK ("institutionId" = current_institution_id());

CREATE POLICY tenant_isolation_audit_log ON "audit_log"
  USING ("institutionId" IS NULL OR "institutionId" = current_institution_id())
  WITH CHECK ("institutionId" IS NULL OR "institutionId" = current_institution_id());

-- ─── Trigram indexes for ILIKE search (design §9.1) ─────────────────────
CREATE INDEX "users_fullName_trgm_idx"        ON "users"             USING gin ("fullName" gin_trgm_ops);
CREATE INDEX "users_email_trgm_idx"           ON "users"             USING gin ("email" gin_trgm_ops);
CREATE INDEX "institutions_name_trgm_idx"     ON "institutions"      USING gin ("name" gin_trgm_ops);
CREATE INDEX "institutions_subdomain_trgm_idx" ON "institutions"     USING gin ("subdomain" gin_trgm_ops);

-- ─── Grants (the application connects as the DB owner; RLS still applies
--     because we used FORCE ROW LEVEL SECURITY above). The two roles are
--     reserved for future connection pooling / least-privilege. ────────────
GRANT USAGE ON SCHEMA public TO app_user, app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user, app_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, app_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user, app_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user, app_admin;

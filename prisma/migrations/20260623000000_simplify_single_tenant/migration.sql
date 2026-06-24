-- Migration: simplify_single_tenant
--
-- Removes all multi-tenant infrastructure:
--   - Drops RLS policies and dual Postgres roles
--   - Drops institutionId columns from all business tables
--   - Renames institutions → app_config (single-row config)
--   - Migrates UserRole enum: SUPER_ADMIN + INSTITUTION_ADMIN → ADMIN
--   - Adds UNIQUE(email) on users, drops composite unique
--
-- For dev: if you have no production data, prefer:
--   pnpm prisma migrate reset
-- This migration is for environments that need the transition SQL.
--
-- NOTE: DROP ROLE is cluster-level. If your DB user lacks SUPERUSER,
-- run the DROP ROLE statements manually in psql before this migration.

-- ─── 1. Drop RLS policies ──────────────────────────────────────────────

DO $$ BEGIN
  -- Drop all policies that may exist on each table.
  -- Using IF EXISTS equivalent via DO block for safety.
  EXECUTE (
    SELECT string_agg(
      format('DROP POLICY IF EXISTS %I ON %I;', policyname, tablename),
      E'\n'
    )
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users','subjects','courses','course_teachers',
        'enrollments','class_sessions','attendance_records',
        'refresh_tokens','audit_log','institutions'
      )
  );
END $$;

-- Disable RLS on all tables
ALTER TABLE IF EXISTS "users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "subjects" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "courses" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "course_teachers" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "enrollments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "class_sessions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "attendance_records" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "refresh_tokens" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "audit_log" DISABLE ROW LEVEL SECURITY;

-- Drop helper function if exists
DROP FUNCTION IF EXISTS current_institution_id();

-- ─── 2. Drop Postgres roles (cluster-level — may need superuser) ───────
DO $$ BEGIN
  -- Revoke all privileges so the DROP doesn't fail with dependent_object_error.
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM app_user';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM app_user';
    EXECUTE 'REVOKE ALL PRIVILEGES ON SCHEMA public FROM app_user';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM app_user';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM app_user';
    DROP ROLE app_user;
    RAISE NOTICE 'Dropped role app_user';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM app_admin';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM app_admin';
    EXECUTE 'REVOKE ALL PRIVILEGES ON SCHEMA public FROM app_admin';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM app_admin';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM app_admin';
    DROP ROLE app_admin;
    RAISE NOTICE 'Dropped role app_admin';
  END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping DROP ROLE — run manually as superuser';
END $$;

-- ─── 3. Rename institutions → app_config, drop unneeded columns ────────

ALTER TABLE IF EXISTS "institutions" RENAME TO "app_config";

ALTER TABLE "app_config"
  DROP COLUMN IF EXISTS "subdomain",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "plan",
  DROP COLUMN IF EXISTS "deletedAt",
  DROP COLUMN IF EXISTS "createdAt";

-- Drop InstitutionStatus enum if it exists
DROP TYPE IF EXISTS "InstitutionStatus";

-- ─── 4. Add ADMIN to UserRole enum, migrate data ────────────────────────

-- ADD VALUE cannot run inside a transaction in PG < 12.
-- We use a DO block so it can commit implicitly if needed.
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
END $$;

-- Migrate existing admin roles to ADMIN
UPDATE "users"
SET role = 'ADMIN'::"UserRole"
WHERE role::text IN ('SUPER_ADMIN', 'INSTITUTION_ADMIN');

-- Recreate enum without old values (PostgreSQL doesn't support DROP VALUE).
-- We rename the old type, create the new one, alter columns, then drop old.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole"
  USING role::text::"UserRole";

DROP TYPE "UserRole_old";

-- ─── 5. Remove institutionId from all tables ────────────────────────────

-- Drop FK constraints first
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_institutionId_fkey";
ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "subjects_institutionId_fkey";
ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_institutionId_fkey";
ALTER TABLE "course_teachers" DROP CONSTRAINT IF EXISTS "course_teachers_institutionId_fkey";
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_institutionId_fkey";
ALTER TABLE "class_sessions" DROP CONSTRAINT IF EXISTS "class_sessions_institutionId_fkey";
ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "attendance_records_institutionId_fkey";
ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_institutionId_fkey";

-- Drop institutionId unique indexes
DROP INDEX IF EXISTS "users_institutionId_email_key";
DROP INDEX IF EXISTS "subjects_institutionId_code_key";
DROP INDEX IF EXISTS "courses_institutionId_code_key";

-- Drop composite indexes that start with institutionId
DROP INDEX IF EXISTS "users_institutionId_role_idx";
DROP INDEX IF EXISTS "users_institutionId_status_idx";
DROP INDEX IF EXISTS "users_institutionId_fullName_idx";
DROP INDEX IF EXISTS "users_institutionId_deletedAt_idx";
DROP INDEX IF EXISTS "subjects_institutionId_deletedAt_idx";
DROP INDEX IF EXISTS "courses_institutionId_semester_idx";
DROP INDEX IF EXISTS "courses_institutionId_subjectId_idx";
DROP INDEX IF EXISTS "courses_institutionId_deletedAt_idx";
DROP INDEX IF EXISTS "course_teachers_institutionId_teacherId_idx";
DROP INDEX IF EXISTS "enrollments_institutionId_studentId_idx";
DROP INDEX IF EXISTS "class_sessions_institutionId_scheduledAt_idx";
DROP INDEX IF EXISTS "class_sessions_institutionId_status_scheduledAt_idx";
DROP INDEX IF EXISTS "attendance_records_institutionId_studentId_recordedAt_idx";
DROP INDEX IF EXISTS "attendance_records_institutionId_recordedAt_idx";
DROP INDEX IF EXISTS "audit_log_institutionId_createdAt_idx";

-- Drop institutionId columns
ALTER TABLE "users" DROP COLUMN IF EXISTS "institution_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "subjects" DROP COLUMN IF EXISTS "institution_id";
ALTER TABLE "subjects" DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "institution_id";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "course_teachers" DROP COLUMN IF EXISTS "institution_id";
ALTER TABLE "course_teachers" DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "enrollments" DROP COLUMN IF EXISTS "institution_id";
ALTER TABLE "enrollments" DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "class_sessions" DROP COLUMN IF EXISTS "institution_id";
ALTER TABLE "class_sessions" DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "attendance_records" DROP COLUMN IF EXISTS "institution_id";
ALTER TABLE "attendance_records" DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "audit_log" DROP COLUMN IF EXISTS "institution_id";
ALTER TABLE "audit_log" DROP COLUMN IF EXISTS "institutionId";

-- ─── 6. Add UNIQUE(email) on users ─────────────────────────────────────

ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

-- Make legajo globally unique (was per-institution before)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_institutionId_legajo_key";

-- ─── 7. Create new indexes ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");
CREATE INDEX IF NOT EXISTS "users_fullName_idx" ON "users"("fullName");
CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users"("deletedAt");
CREATE INDEX IF NOT EXISTS "subjects_deletedAt_idx" ON "subjects"("deletedAt");
CREATE INDEX IF NOT EXISTS "courses_semester_idx" ON "courses"("semester");
CREATE INDEX IF NOT EXISTS "courses_subjectId_idx" ON "courses"("subjectId");
CREATE INDEX IF NOT EXISTS "courses_deletedAt_idx" ON "courses"("deletedAt");
CREATE INDEX IF NOT EXISTS "course_teachers_teacherId_idx" ON "course_teachers"("teacherId");
CREATE INDEX IF NOT EXISTS "enrollments_studentId_idx" ON "enrollments"("studentId");

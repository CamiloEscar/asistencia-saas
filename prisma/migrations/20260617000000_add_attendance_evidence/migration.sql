-- Add `evidence_url` column to `attendance_records` for image-based
-- attendance justifications (Task 11.7 / REQ-ATT evidence).
-- Stored as TEXT (URL) — Cloudinary returns long URLs with
-- transform parameters that can exceed 2KB.
--
-- Backward-compatible: column is nullable, no default, no
-- backfill needed (existing rows keep evidence_url = NULL).

ALTER TABLE "attendance_records"
  ADD COLUMN "evidenceUrl" TEXT;

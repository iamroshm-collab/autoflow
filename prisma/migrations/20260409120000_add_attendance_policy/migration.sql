-- Migration: add AttendancePolicy and AttendancePolicyAuditLog models

CREATE TABLE IF NOT EXISTS "AttendancePolicy" (
  "policyId" text PRIMARY KEY,
  "companyId" text NOT NULL UNIQUE,
  "policy" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AttendancePolicyAuditLog" (
  "id" text PRIMARY KEY,
  "policyId" text NOT NULL,
  "changedBy" text NOT NULL,
  "oldValue" jsonb,
  "newValue" jsonb NOT NULL,
  "timestamp" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AttendancePolicy_companyId_idx" ON "AttendancePolicy" ("companyId");
CREATE INDEX IF NOT EXISTS "AttendancePolicyAuditLog_policyId_idx" ON "AttendancePolicyAuditLog" ("policyId");
CREATE INDEX IF NOT EXISTS "AttendancePolicyAuditLog_timestamp_idx" ON "AttendancePolicyAuditLog" ("timestamp");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendancePolicyAuditLog_policyId_fkey'
  ) THEN
    ALTER TABLE "AttendancePolicyAuditLog"
      ADD CONSTRAINT "AttendancePolicyAuditLog_policyId_fkey"
      FOREIGN KEY ("policyId")
      REFERENCES "AttendancePolicy"("policyId")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

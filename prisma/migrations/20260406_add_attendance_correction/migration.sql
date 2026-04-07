-- Migration: add AttendanceCorrection model
-- Generated: 2026-04-06

BEGIN;

CREATE TABLE IF NOT EXISTS "AttendanceCorrection" (
  "id" serial PRIMARY KEY,
  "attendanceId" integer NOT NULL,
  "employeeId" integer NOT NULL,
  "recordDate" text NOT NULL,
  "originalCheckIn" timestamp with time zone,
  "originalCheckOut" timestamp with time zone,
  "updatedCheckIn" timestamp with time zone,
  "updatedCheckOut" timestamp with time zone,
  "adminUser" text NOT NULL,
  "verificationTimestamp" timestamp with time zone NOT NULL,
  "verificationImagePath" text NOT NULL,
  "correctedAt" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AttendanceCorrection_employeeId_idx" ON "AttendanceCorrection" ("employeeId");
CREATE INDEX IF NOT EXISTS "AttendanceCorrection_attendanceId_idx" ON "AttendanceCorrection" ("attendanceId");

COMMIT;

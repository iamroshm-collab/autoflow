-- Migration: add EmployeeShift model and attendance status fields
-- Generated: 2026-04-06

BEGIN;

-- Add new columns to AttendancePayroll
ALTER TABLE "AttendancePayroll"
  ADD COLUMN IF NOT EXISTS "checkInStatus" text;

ALTER TABLE "AttendancePayroll"
  ADD COLUMN IF NOT EXISTS "checkOutStatus" text;

ALTER TABLE "AttendancePayroll"
  ADD COLUMN IF NOT EXISTS "lateMinutes" integer DEFAULT 0;

-- Create EmployeeShift table
CREATE TABLE IF NOT EXISTS "EmployeeShift" (
  "id" serial PRIMARY KEY,
  "employeeId" integer NOT NULL UNIQUE,
  "shiftStart" text NOT NULL,
  "shiftEnd" text NOT NULL,
  "gracePeriodMins" integer NOT NULL DEFAULT 10,
  "overtimeThresholdMins" integer NOT NULL DEFAULT 30,
  CONSTRAINT "EmployeeShift_employee_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("employeeId") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "EmployeeShift_employeeId_idx" ON "EmployeeShift" ("employeeId");

COMMIT;

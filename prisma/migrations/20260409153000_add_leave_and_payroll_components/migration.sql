-- Employee payroll component columns
ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "monthly_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "working_days_in_month" INTEGER NOT NULL DEFAULT 26,
ADD COLUMN IF NOT EXISTS "per_day_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "basic_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "house_rent_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dearness_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "conveyance_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "medical_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "special_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "travel_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "internet_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "other_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "gross_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "pf_applicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "esi_applicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "professional_tax_applicable" BOOLEAN NOT NULL DEFAULT false;

-- Keep legacy salaryPerday synchronized for existing rows
UPDATE "Employee"
SET "per_day_salary" = CASE
  WHEN COALESCE("monthly_salary", 0) > 0 AND COALESCE("working_days_in_month", 0) > 0
    THEN ROUND(("monthly_salary" / "working_days_in_month")::numeric, 2)::double precision
  ELSE COALESCE("salaryPerday", 0)
END
WHERE COALESCE("per_day_salary", 0) = 0;

UPDATE "Employee"
SET "salaryPerday" = COALESCE("per_day_salary", 0)
WHERE COALESCE("salaryPerday", 0) = 0;

-- Leave master table
CREATE TABLE IF NOT EXISTS "leave_types" (
  "id" TEXT PRIMARY KEY,
  "leave_name" TEXT NOT NULL,
  "leave_code" TEXT NOT NULL,
  "max_days_per_year" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paid_percentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "requires_approval" BOOLEAN NOT NULL DEFAULT true,
  "gender_restriction" TEXT NOT NULL DEFAULT 'none',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_leave_code_key" ON "leave_types"("leave_code");
CREATE INDEX IF NOT EXISTS "leave_types_leave_code_idx" ON "leave_types"("leave_code");

-- Employee leave balances
CREATE TABLE IF NOT EXISTS "employee_leave_balance" (
  "id" TEXT PRIMARY KEY,
  "employee_id" INTEGER NOT NULL,
  "leave_type_id" TEXT NOT NULL,
  "total_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "used_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "remaining_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_leave_balance_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "Employee"("employeeId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "employee_leave_balance_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_leave_balance_employee_id_leave_type_id_key"
ON "employee_leave_balance"("employee_id", "leave_type_id");
CREATE INDEX IF NOT EXISTS "employee_leave_balance_employee_id_idx" ON "employee_leave_balance"("employee_id");
CREATE INDEX IF NOT EXISTS "employee_leave_balance_leave_type_id_idx" ON "employee_leave_balance"("leave_type_id");

-- Leave requests workflow
CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" TEXT PRIMARY KEY,
  "employee_id" INTEGER NOT NULL,
  "leave_type_id" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "total_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by" TEXT,
  "approval_date" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_requests_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "Employee"("employeeId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "leave_requests_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "leave_requests_employee_id_status_idx" ON "leave_requests"("employee_id", "status");
CREATE INDEX IF NOT EXISTS "leave_requests_status_requested_at_idx" ON "leave_requests"("status", "requested_at");
CREATE INDEX IF NOT EXISTS "leave_requests_start_date_end_date_idx" ON "leave_requests"("start_date", "end_date");

-- Seed common Indian leave types
INSERT INTO "leave_types" (
  "id", "leave_name", "leave_code", "max_days_per_year", "paid_percentage", "requires_approval", "gender_restriction", "is_active"
)
VALUES
  (md5(random()::text || clock_timestamp()::text), 'Casual Leave', 'CL', 12, 100, true, 'none', true),
  (md5(random()::text || clock_timestamp()::text), 'Sick Leave', 'SL', 12, 100, true, 'none', true),
  (md5(random()::text || clock_timestamp()::text), 'Earned Leave', 'EL', 18, 100, true, 'none', true),
  (md5(random()::text || clock_timestamp()::text), 'Privilege Leave', 'PL', 18, 100, true, 'none', true),
  (md5(random()::text || clock_timestamp()::text), 'Maternity Leave', 'ML', 180, 100, true, 'female', true),
  (md5(random()::text || clock_timestamp()::text), 'Paternity Leave', 'PLT', 15, 100, true, 'male', true),
  (md5(random()::text || clock_timestamp()::text), 'Compensatory Leave', 'CO', 12, 100, true, 'none', true),
  (md5(random()::text || clock_timestamp()::text), 'Half Pay Leave', 'HPL', 20, 50, true, 'none', true),
  (md5(random()::text || clock_timestamp()::text), 'Leave Without Pay', 'LWP', 365, 0, true, 'none', true),
  (md5(random()::text || clock_timestamp()::text), 'Medical Leave', 'MED', 12, 100, true, 'none', true)
ON CONFLICT ("leave_code") DO UPDATE
SET
  "leave_name" = EXCLUDED."leave_name",
  "max_days_per_year" = EXCLUDED."max_days_per_year",
  "paid_percentage" = EXCLUDED."paid_percentage",
  "requires_approval" = EXCLUDED."requires_approval",
  "gender_restriction" = EXCLUDED."gender_restriction",
  "is_active" = EXCLUDED."is_active",
  "updatedAt" = CURRENT_TIMESTAMP;

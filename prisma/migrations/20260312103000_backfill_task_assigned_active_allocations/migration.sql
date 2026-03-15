-- Backfill taskAssigned for active allocations where value is blank.
-- 1) Prefer workType from EmployeeEarning for the same job/employee.
WITH latest_employee_task AS (
  SELECT DISTINCT ON ("jobCardId", "employeeID")
    "jobCardId",
    "employeeID",
    BTRIM("workType") AS "workType"
  FROM "EmployeeEarning"
  WHERE COALESCE(BTRIM("workType"), '') <> ''
  ORDER BY "jobCardId", "employeeID", "updatedAt" DESC, "createdAt" DESC
)
UPDATE "TechnicianAllocations" ta
SET "taskAssigned" = let."workType"
FROM latest_employee_task let
WHERE ta."jobId" = let."jobCardId"
  AND ta."employeeId"::TEXT = let."employeeID"
  AND ta."status" IN ('assigned', 'accepted', 'in_progress')
  AND COALESCE(BTRIM(ta."taskAssigned"), '') = '';

-- 2) Any remaining blanks get a readable default so tasks are visible in My Jobs.
UPDATE "TechnicianAllocations"
SET "taskAssigned" = 'General Service'
WHERE "status" IN ('assigned', 'accepted', 'in_progress')
  AND COALESCE(BTRIM("taskAssigned"), '') = '';

-- Add taskAssigned column for existing databases that were created before
-- task-assignment support was introduced in the Prisma schema.
ALTER TABLE "TechnicianAllocations"
ADD COLUMN IF NOT EXISTS "taskAssigned" TEXT NOT NULL DEFAULT '';

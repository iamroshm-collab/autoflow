-- Reconcile breakdown pickup columns with current Prisma schema.
-- Current schema tracks pickup via BreakdownMilestone, so these columns should not exist.
ALTER TABLE "Breakdown" DROP COLUMN IF EXISTS "pickedUpAt";
ALTER TABLE "Breakdown" DROP COLUMN IF EXISTS "pickedUpByUserId";
ALTER TABLE "Breakdown" DROP COLUMN IF EXISTS "pickedUpByName";

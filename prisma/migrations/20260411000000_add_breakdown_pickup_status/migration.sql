-- Add PickedUp milestone fields to Breakdown
ALTER TABLE "Breakdown" ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3);
ALTER TABLE "Breakdown" ADD COLUMN IF NOT EXISTS "pickedUpByUserId" TEXT;
ALTER TABLE "Breakdown" ADD COLUMN IF NOT EXISTS "pickedUpByName" TEXT;

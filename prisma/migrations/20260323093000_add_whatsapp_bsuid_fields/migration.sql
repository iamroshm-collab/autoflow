ALTER TABLE "AppUser"
ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
ADD COLUMN IF NOT EXISTS "whatsappId" TEXT;

ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
ADD COLUMN IF NOT EXISTS "whatsappId" TEXT;

UPDATE "AppUser"
SET "phoneNumber" = "mobile"
WHERE "phoneNumber" IS NULL
  AND "mobile" IS NOT NULL;

UPDATE "Employee"
SET "phoneNumber" = "mobile"
WHERE "phoneNumber" IS NULL
  AND "mobile" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_phoneNumber_key"
ON "AppUser"("phoneNumber")
WHERE "phoneNumber" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_whatsappId_key"
ON "AppUser"("whatsappId")
WHERE "whatsappId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Employee_phoneNumber_idx"
ON "Employee"("phoneNumber");

CREATE INDEX IF NOT EXISTS "Employee_whatsappId_idx"
ON "Employee"("whatsappId");
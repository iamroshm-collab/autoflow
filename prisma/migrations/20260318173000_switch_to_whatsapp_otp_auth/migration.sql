ALTER TABLE "Employee" DROP COLUMN IF EXISTS "email";

-- Backfill app user mobile from linked employee records when possible.
UPDATE "AppUser" au
SET "mobile" = e."mobile"
FROM "Employee" e
WHERE au."employeeRefId" = e."employeeId"
  AND (au."mobile" IS NULL OR au."mobile" = '');

ALTER TABLE "AppUser" DROP COLUMN IF EXISTS "email";
ALTER TABLE "AppUser" DROP COLUMN IF EXISTS "passwordHash";
ALTER TABLE "AppUser" DROP COLUMN IF EXISTS "emailVerificationStatus";

DROP TABLE IF EXISTS "email_verification_tokens";
DROP TABLE IF EXISTS "password_reset_tokens";

CREATE TABLE IF NOT EXISTS "whatsapp_otps" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "whatsapp_otps_employeeId_idx" ON "whatsapp_otps"("employeeId");
CREATE INDEX IF NOT EXISTS "whatsapp_otps_mobile_purpose_expiresAt_idx" ON "whatsapp_otps"("mobile", "purpose", "expiresAt");
CREATE INDEX IF NOT EXISTS "whatsapp_otps_expiresAt_idx" ON "whatsapp_otps"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_otps_employeeId_fkey'
  ) THEN
    ALTER TABLE "whatsapp_otps"
    ADD CONSTRAINT "whatsapp_otps_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "AppUser"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_mobile_key" ON "AppUser"("mobile") WHERE "mobile" IS NOT NULL;

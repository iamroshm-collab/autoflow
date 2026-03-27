ALTER TABLE "AppUser"
ADD COLUMN IF NOT EXISTS "emailVerificationStatus" TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE "email_verification_tokens" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");
CREATE INDEX "email_verification_tokens_employeeId_idx" ON "email_verification_tokens"("employeeId");
CREATE INDEX "email_verification_tokens_expiresAt_idx" ON "email_verification_tokens"("expiresAt");

ALTER TABLE "email_verification_tokens"
ADD CONSTRAINT "email_verification_tokens_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "AppUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
CREATE INDEX "password_reset_tokens_employeeId_idx" ON "password_reset_tokens"("employeeId");
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

ALTER TABLE "password_reset_tokens"
ADD CONSTRAINT "password_reset_tokens_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "AppUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_devices" (
  "id" TEXT NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "oneSignalPlayerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_devices_oneSignalPlayerId_key" ON "notification_devices"("oneSignalPlayerId");
CREATE INDEX "notification_devices_employeeId_idx" ON "notification_devices"("employeeId");

ALTER TABLE "notification_devices"
ADD CONSTRAINT "notification_devices_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId")
ON DELETE CASCADE ON UPDATE CASCADE;

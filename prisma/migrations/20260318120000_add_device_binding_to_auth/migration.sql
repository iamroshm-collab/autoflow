ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "registeredDeviceId" TEXT,
ADD COLUMN IF NOT EXISTS "registeredDeviceIp" TEXT,
ADD COLUMN IF NOT EXISTS "deviceRegisteredAt" TIMESTAMP(3);

ALTER TABLE "AppUser"
ADD COLUMN IF NOT EXISTS "requestedDeviceId" TEXT,
ADD COLUMN IF NOT EXISTS "requestedDeviceIp" TEXT,
ADD COLUMN IF NOT EXISTS "pendingDeviceId" TEXT,
ADD COLUMN IF NOT EXISTS "pendingDeviceIp" TEXT,
ADD COLUMN IF NOT EXISTS "approvedDeviceId" TEXT,
ADD COLUMN IF NOT EXISTS "approvedDeviceIp" TEXT,
ADD COLUMN IF NOT EXISTS "deviceApprovalStatus" TEXT NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS "AppUser_deviceApprovalStatus_idx" ON "AppUser"("deviceApprovalStatus");

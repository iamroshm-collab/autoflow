CREATE TABLE IF NOT EXISTS "admin_auth_profiles" (
  "id"          TEXT        NOT NULL,
  "appUserId"   TEXT        NOT NULL,
  "employeeId"  INTEGER,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_auth_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_auth_profiles_appUserId_key" ON "admin_auth_profiles"("appUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_auth_profiles_employeeId_key" ON "admin_auth_profiles"("employeeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_auth_profiles_appUserId_fkey'
  ) THEN
    ALTER TABLE "admin_auth_profiles"
    ADD CONSTRAINT "admin_auth_profiles_appUserId_fkey"
    FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_auth_profiles_employeeId_fkey'
  ) THEN
    ALTER TABLE "admin_auth_profiles"
    ADD CONSTRAINT "admin_auth_profiles_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "admin_trusted_devices" (
  "id"              TEXT        NOT NULL,
  "appUserId"       TEXT        NOT NULL,
  "deviceId"        TEXT        NOT NULL,
  "deviceIp"        TEXT,
  "firstVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive"        BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT "admin_trusted_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_trusted_devices_appUserId_deviceId_key"
  ON "admin_trusted_devices"("appUserId", "deviceId");

CREATE INDEX IF NOT EXISTS "admin_trusted_devices_appUserId_idx" ON "admin_trusted_devices"("appUserId");
CREATE INDEX IF NOT EXISTS "admin_trusted_devices_deviceId_idx"  ON "admin_trusted_devices"("deviceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_trusted_devices_appUserId_fkey'
  ) THEN
    ALTER TABLE "admin_trusted_devices"
    ADD CONSTRAINT "admin_trusted_devices_appUserId_fkey"
    FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

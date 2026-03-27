const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

async function run() {
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS admin_auth_profiles (
      id TEXT PRIMARY KEY,
      "appUserId" TEXT UNIQUE NOT NULL,
      "employeeId" INTEGER UNIQUE,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "lastLoginAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  console.log("admin_auth_profiles: OK")

  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS admin_trusted_devices (
      id TEXT PRIMARY KEY,
      "appUserId" TEXT NOT NULL,
      "deviceId" TEXT NOT NULL,
      "deviceIp" TEXT,
      "firstVerifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lastUsedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE("appUserId", "deviceId")
    )
  `)
  console.log("admin_trusted_devices: OK")

  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_atd_appuser ON admin_trusted_devices("appUserId")`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_atd_deviceid ON admin_trusted_devices("deviceId")`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_aap_appuser ON admin_auth_profiles("appUserId")`)
  console.log("Indexes: OK")

  await p.$disconnect()
  console.log("Done.")
}

run().catch(async (e) => {
  console.error(e.message)
  await p.$disconnect()
  process.exit(1)
})

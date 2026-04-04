const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Adding refType/refId columns to AppNotification if missing...')
  await prisma.$executeRawUnsafe('ALTER TABLE "AppNotification" ADD COLUMN IF NOT EXISTS "refType" text;')
  await prisma.$executeRawUnsafe('ALTER TABLE "AppNotification" ADD COLUMN IF NOT EXISTS "refId" text;')
  // create index if not exists
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AppNotification_refType_refId_idx" ON "AppNotification" ("refType", "refId");')
  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())

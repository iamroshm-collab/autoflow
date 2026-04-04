const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check(field) {
  // Use parameterized/raw tagged query with quoted identifiers to avoid lowercasing
  const q = `SELECT "${field}", count(*) FROM "AppUser" WHERE "${field}" IS NOT NULL GROUP BY "${field}" HAVING count(*) > 1 LIMIT 5;`
  const res = await prisma.$queryRawUnsafe(q)
  return res
}

async function main() {
  console.log('Checking AppUser duplicates for fields: mobile, phoneNumber, whatsappId')
  const mobileDup = await check('mobile')
  const phoneDup = await check('phoneNumber')
  const waDup = await check('whatsappId')

  console.log('mobile duplicates:', JSON.stringify(mobileDup, null, 2))
  console.log('phoneNumber duplicates:', JSON.stringify(phoneDup, null, 2))
  console.log('whatsappId duplicates:', JSON.stringify(waDup, null, 2))

  const any = (mobileDup.length || phoneDup.length || waDup.length)
  if (any) {
    console.log('\nFound duplicates — DO NOT run db push with unique constraints until resolved.')
    process.exit(2)
  } else {
    console.log('\nNo duplicates found. Safe to push schema for these constraints.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

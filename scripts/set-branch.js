const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const branchName = 'Primary Branch'
  const stateCode = '29'
  const gstin = '29AAAAA0000A1Z5'

  const existing = await prisma.branch.findFirst()
  if (existing) {
    await prisma.branch.update({ where: { id: existing.id }, data: { branchName, stateCode, gstin } })
    console.log('Updated existing branch', existing.id)
  } else {
    const b = await prisma.branch.create({ data: { branchName, stateCode, gstin } })
    console.log('Created branch', b.id)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

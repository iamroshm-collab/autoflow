const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const mobile = process.argv[2]

if (!mobile) {
  console.error("Usage: node scripts/approve-user.js <10-digit-mobile>")
  process.exit(1)
}

async function main() {
  const user = await prisma.appUser.findFirst({ where: { mobile } })
  if (!user) {
    console.error("User not found for mobile:", mobile)
    process.exit(1)
  }

  const updated = await prisma.appUser.update({
    where: { id: user.id },
    data: {
      approvalStatus: "approved",
      approvedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      mobile: true,
      role: true,
      approvalStatus: true,
      approvedAt: true,
    },
  })

  console.log(JSON.stringify(updated, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const mobile = process.argv[2]

if (!mobile) {
  console.error("Usage: node scripts/delete-user.js <10-digit-mobile>")
  process.exit(1)
}

async function main() {
  const user = await prisma.appUser.findFirst({
    where: { mobile },
    select: { id: true, name: true, mobile: true, role: true, approvalStatus: true },
  })

  if (!user) {
    console.log(JSON.stringify({ deleted: false, reason: "not_found", mobile }, null, 2))
    return
  }

  await prisma.appUser.delete({ where: { id: user.id } })

  console.log(
    JSON.stringify(
      {
        deleted: true,
        user,
      },
      null,
      2
    )
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

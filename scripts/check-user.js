const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

p.appUser.findFirst({
  where: { mobile: "8547957114" },
  select: {
    id: true,
    name: true,
    mobile: true,
    role: true,
    approvalStatus: true,
    deviceApprovalStatus: true,
    pendingDeviceId: true,
    approvedDeviceId: true,
    createdAt: true,
    updatedAt: true,
  },
}).then((u) => {
  console.log(JSON.stringify(u, null, 2))
  return p.$disconnect()
}).catch((e) => { console.error(e.message); return p.$disconnect() })

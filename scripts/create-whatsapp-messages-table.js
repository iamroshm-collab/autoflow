// Script to create whatsapp_messages table directly
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") })
const { PrismaClient } = require("@prisma/client")

const p = new PrismaClient()

async function run() {
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id TEXT PRIMARY KEY,
      "waMessageId" TEXT UNIQUE,
      "whatsappId" TEXT NOT NULL,
      "phoneNumber" TEXT,
      "senderName" TEXT,
      content TEXT NOT NULL,
      "messageType" TEXT NOT NULL DEFAULT 'text',
      status TEXT NOT NULL DEFAULT 'received',
      "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_wm_whatsappid ON whatsapp_messages("whatsappId")`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_wm_phone ON whatsapp_messages("phoneNumber")`)
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_wm_received ON whatsapp_messages("receivedAt")`)
  console.log("whatsapp_messages table ready")
  await p.$disconnect()
}

run().catch((e) => {
  console.error(e.message)
  p.$disconnect()
  process.exit(1)
})

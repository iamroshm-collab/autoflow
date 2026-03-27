const fs = require("node:fs")
const path = require("node:path")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const baseUrl = (process.env.WEBHOOK_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "")
const migrationFixturePath = path.join(__dirname, "fixtures", "meta-webhook-bsuid-migration.json")
const guestFixturePath = path.join(__dirname, "fixtures", "meta-webhook-guest-bsuid.json")

const uniqueMobile = () => {
  const suffix = String(Date.now()).slice(-6)
  return `9876${suffix}`
}

const readJson = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

const postWebhook = async (payload) => {
  const response = await fetch(`${baseUrl}/api/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const body = await response.json().catch(() => ({}))

  if (response.status !== 200) {
    throw new Error(`Expected 200 OK, got ${response.status}: ${JSON.stringify(body)}`)
  }

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${JSON.stringify(body)}`)
  }

  return body
}

async function main() {
  const seededMobile = uniqueMobile()
  const seededWhatsappId = "bsuid:test:migration"
  const guestWhatsappId = "bsuid:test:guest"
  let seededUserId = null
  let guestUserId = null

  try {
    await prisma.appUser.deleteMany({
      where: {
        OR: [
          { whatsappId: seededWhatsappId },
          { whatsappId: guestWhatsappId },
          { phoneNumber: seededMobile },
          { mobile: seededMobile },
        ],
      },
    })

    const seededUser = await prisma.appUser.create({
      data: {
        name: "Webhook Smoke Test User",
        role: "technician",
        approvalStatus: "pending",
        mobile: seededMobile,
        phoneNumber: seededMobile,
      },
      select: {
        id: true,
      },
    })
    seededUserId = seededUser.id

    const migrationPayload = readJson(migrationFixturePath)
    migrationPayload.entry[0].changes[0].value.contacts[0].wa_id = `91${seededMobile}`
    migrationPayload.entry[0].changes[0].value.messages[0].from = `91${seededMobile}`

    const migrationResponse = await postWebhook(migrationPayload)

    if (!Array.isArray(migrationResponse.results) || migrationResponse.results.length === 0) {
      throw new Error(`Expected webhook response.results array, got ${JSON.stringify(migrationResponse)}`)
    }

    const firstResult = migrationResponse.results[0] || {}
    if (firstResult.action !== "migrated-whatsapp-id") {
      throw new Error(`Expected action=migrated-whatsapp-id, got ${JSON.stringify(firstResult)}`)
    }

    if (firstResult.userId !== seededUser.id) {
      throw new Error(`Expected migrated userId ${seededUser.id}, got ${JSON.stringify(firstResult)}`)
    }

    const migratedUser = await prisma.appUser.findUnique({
      where: { id: seededUser.id },
      select: {
        phoneNumber: true,
        whatsappId: true,
      },
    })

    if (!migratedUser || migratedUser.whatsappId !== seededWhatsappId) {
      throw new Error(`Expected seeded user whatsappId to be ${seededWhatsappId}, got ${JSON.stringify({ migrationResponse, migratedUser })}`)
    }

    const guestPayload = readJson(guestFixturePath)
    const guestResponse = await postWebhook(guestPayload)
    const guestUser = await prisma.appUser.findFirst({
      where: { whatsappId: guestWhatsappId },
      select: {
        id: true,
        role: true,
        phoneNumber: true,
      },
    })

    if (!guestUser || guestUser.role !== "guest") {
      throw new Error(`Expected guest user for ${guestWhatsappId}, got ${JSON.stringify(guestUser)}`)
    }

    guestUserId = guestUser.id

    console.log("[WEBHOOK_SMOKE] Expected server log contains [META_WHATSAPP_WEBHOOK] with migrated-whatsapp-id and created-guest actions")
    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      migrationResponse,
      migratedUser,
      guestResponse,
      guestUser,
    }, null, 2))
  } finally {
    const idsToDelete = [seededUserId, guestUserId].filter(Boolean)
    await prisma.appUser.deleteMany({
      where: {
        OR: [
          ...(idsToDelete.length > 0 ? [{ id: { in: idsToDelete } }] : []),
          { whatsappId: seededWhatsappId },
          { whatsappId: guestWhatsappId },
          { phoneNumber: seededMobile },
          { mobile: seededMobile },
        ],
      },
    })
    await prisma.$disconnect()
  }
}

main().catch(async (error) => {
  console.error("[META_WEBHOOK_SMOKE_TEST]", error)
  await prisma.$disconnect()
  process.exit(1)
})
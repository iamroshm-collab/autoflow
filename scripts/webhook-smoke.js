const baseUrl = String(process.env.WEBHOOK_BASE_URL || "").trim().replace(/\/$/, "")

if (!baseUrl) {
  console.error("[WEBHOOK_SMOKE][FAIL] WEBHOOK_BASE_URL is required.")
  process.exit(1)
}

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-smoke-test",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550001111",
              phone_number_id: "1234567890",
            },
            contacts: [
              {
                profile: {
                  name: "Smoke Test",
                },
                wa_id: "919876543210",
              },
            ],
            messages: [
              {
                from: "919876543210",
                id: "wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSOTZDQjQ4OTQ2ODk2Nzg5AA==",
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                user_id: "bsuid:deploy:smoke:user",
                text: {
                  body: "deployment smoke test",
                },
              },
            ],
          },
        },
      ],
    },
  ],
}

async function main() {
  const url = `${baseUrl}/api/webhook`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const responseText = await response.text()

  if (response.status !== 200) {
    console.error(`[WEBHOOK_SMOKE][FAIL] Expected 200 OK from ${url}, got ${response.status}.`)
    console.error(`[WEBHOOK_SMOKE][BODY] ${responseText}`)
    process.exit(1)
  }

  console.log(`[WEBHOOK_SMOKE] PASS: ${url} returned 200 OK.`)
  console.log("[WEBHOOK_SMOKE] Check server logs for [META_WHATSAPP_WEBHOOK] to confirm user identification details.")
}

main().catch((error) => {
  console.error("[WEBHOOK_SMOKE][FAIL]", error instanceof Error ? error.message : String(error))
  process.exit(1)
})

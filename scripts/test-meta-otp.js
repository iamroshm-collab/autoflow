/**
 * Test script: send a WhatsApp OTP via Meta Cloud API
 * Usage:  node scripts/test-meta-otp.js <mobile>
 * Example: node scripts/test-meta-otp.js 9876543210
 */

const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })

const mobile = process.argv[2]

if (!mobile || !/^\d{10}$/.test(mobile)) {
  console.error("❌  Please provide a valid 10-digit mobile number.")
  console.error("    Usage: node scripts/test-meta-otp.js 9876543210")
  process.exit(1)
}

const accessToken  = (process.env.META_WHATSAPP_ACCESS_TOKEN  || "").trim()
const phoneNumberId = (process.env.META_WHATSAPP_PHONE_NUMBER_ID || "").trim()
const apiVersion   = (process.env.META_WHATSAPP_API_VERSION   || "v20.0").trim()
const templateName = (process.env.META_WHATSAPP_OTP_TEMPLATE_NAME || "").trim()

if (!accessToken || !phoneNumberId || !templateName) {
  console.error("❌  Missing env vars. Check META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID, META_WHATSAPP_OTP_TEMPLATE_NAME in .env.local")
  process.exit(1)
}

const otp = String(Math.floor(100000 + Math.random() * 900000))
const to  = `91${mobile}`

const createPayload = (includeButtonParam = false) => ({
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: {
    name: templateName,
    language: { code: "en_US" },
    components: [
      {
        type: "body",
        parameters: [{ type: "text", text: otp }],
      },
      ...(includeButtonParam
        ? [
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: otp }],
            },
          ]
        : []),
    ],
  },
})

const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`

console.log(`\n📤  Sending OTP ${otp} to +${to} using template "${templateName}"...`)
console.log(`    URL: ${url}\n`)

async function send(includeButtonParam = false) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(createPayload(includeButtonParam)),
  })
}

send(false)
  .then(async (res) => {
    const body = await res.json()

    if (res.ok) {
      console.log("✅  Success!")
      console.log("    Message ID:", body?.messages?.[0]?.id)
      return
    }

    const details = body?.error?.error_data?.details || ""
    if (details.includes("Button at index 0 of type Url requires a parameter")) {
      console.log("ℹ️  Template requires URL button param, retrying...")
      const retry = await send(true)
      const retryBody = await retry.json()
      if (retry.ok) {
        console.log("✅  Success after button-param retry!")
        console.log("    Message ID:", retryBody?.messages?.[0]?.id)
        return
      }
      console.error("❌  API Error (retry):", JSON.stringify(retryBody, null, 2))
      return
    }

    console.error("❌  API Error:", JSON.stringify(body, null, 2))
  })
  .catch((err) => {
    console.error("❌  Network error:", err.message)
  })

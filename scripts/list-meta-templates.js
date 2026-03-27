const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })

const token  = (process.env.META_WHATSAPP_ACCESS_TOKEN  || "").trim()
const wabaId = (process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim()
const version = (process.env.META_WHATSAPP_API_VERSION || "v20.0").trim()

fetch(`https://graph.facebook.com/${version}/${wabaId}/message_templates?fields=name,status,language&limit=50`, {
  headers: { Authorization: `Bearer ${token}` },
})
  .then((r) => r.json())
  .then((d) => {
    if (d.error) { console.error("API Error:", JSON.stringify(d.error, null, 2)); return }
    console.log("\nApproved templates:\n")
    ;(d.data || []).forEach((t) => console.log(`  [${t.status}] lang=${t.language}  name=${t.name}`))
  })
  .catch((e) => console.error(e.message))

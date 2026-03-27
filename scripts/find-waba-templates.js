const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })

const token   = (process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim()
const phoneId = (process.env.META_WHATSAPP_PHONE_NUMBER_ID || "").trim()
const version = (process.env.META_WHATSAPP_API_VERSION || "v20.0").trim()

// Get phone number details including its WABA
fetch(`https://graph.facebook.com/${version}/${phoneId}?fields=id,display_phone_number`, {
  headers: { Authorization: `Bearer ${token}` },
})
  .then((r) => r.json())
  .then((d) => {
    console.log("Phone number details:")
    console.log(JSON.stringify(d, null, 2))
    const wabaId = d.whatsapp_business_account_id
    if (wabaId) {
      console.log("\nFetching templates for WABA:", wabaId)
      return fetch(`https://graph.facebook.com/${version}/${wabaId}/message_templates?fields=name,status,language&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json())
    }
  })
  .then((d) => {
    if (!d) return
    if (d.error) { console.error("Template API Error:", JSON.stringify(d.error, null, 2)); return }
    console.log("\nTemplates found:")
    ;(d.data || []).forEach((t) => console.log(`  [${t.status}] lang=${t.language}  name=${t.name}`))
  })
  .catch((e) => console.error(e.message))

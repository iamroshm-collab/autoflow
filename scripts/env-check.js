const required = {
  META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: String(process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim(),
  WHATSAPP_ACCESS_TOKEN: String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim(),
}

const appId = String(process.env.META_APP_ID || "").trim()
const appSecret = String(process.env.META_APP_SECRET || "").trim()

const SIXTY_DAYS_SECONDS = 60 * 24 * 60 * 60

const logInfo = (message) => console.log(`[ENV_CHECK] ${message}`)
const logWarn = (message) => console.warn(`[ENV_CHECK][WARN] ${message}`)
const logFail = (message) => {
  console.error(`[ENV_CHECK][FAIL] ${message}`)
  process.exitCode = 1
}

const hasValue = (value) => Boolean(String(value || "").trim())

const normalizeScopes = (data) => {
  const directScopes = Array.isArray(data?.scopes) ? data.scopes : []
  const granularScopes = Array.isArray(data?.granular_scopes)
    ? data.granular_scopes
        .map((entry) => String(entry?.scope || "").trim())
        .filter(Boolean)
    : []

  return Array.from(new Set([...directScopes, ...granularScopes]))
}

const classifyTokenType = (typeValue) => {
  const type = String(typeValue || "").toUpperCase()

  if (type === "SYSTEM_USER") {
    return { permanent: true, label: "Permanent (System User)" }
  }

  if (type) {
    return { permanent: false, label: `Temporary (${type})` }
  }

  return { permanent: false, label: "Temporary (Unknown Type)" }
}

const checkRequired = () => {
  if (!hasValue(required.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN)) {
    logFail("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN is missing.")
  } else {
    logInfo("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN is present.")
  }

  if (!hasValue(required.WHATSAPP_ACCESS_TOKEN)) {
    logFail("WHATSAPP_ACCESS_TOKEN is missing.")
  } else {
    logInfo("WHATSAPP_ACCESS_TOKEN is present.")
  }
}

const debugToken = async () => {
  if (!appId || !appSecret) {
    logFail("META_APP_ID and META_APP_SECRET are required to call /debug_token.")
    return null
  }

  const appAccessToken = `${appId}|${appSecret}`
  const url = `https://graph.facebook.com/v20.0/debug_token?input_token=${encodeURIComponent(required.WHATSAPP_ACCESS_TOKEN)}&access_token=${encodeURIComponent(appAccessToken)}`

  const response = await fetch(url)
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    logFail(`debug_token request failed (${response.status}): ${JSON.stringify(body)}`)
    return null
  }

  const data = body?.data || {}
  if (!data?.is_valid) {
    logFail("debug_token reports WHATSAPP_ACCESS_TOKEN is invalid.")
    return null
  }

  return data
}

const evaluateToken = (data) => {
  const tokenType = classifyTokenType(data?.type)
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = Number(data?.expires_at || 0)
  const secondsToExpiry = expiresAt > 0 ? expiresAt - now : Infinity

  logInfo(`Token Type: ${tokenType.label}`)

  if (!tokenType.permanent) {
    logWarn("Access token is not a System User token. Use a Permanent System User token for production.")
  }

  if (Number.isFinite(secondsToExpiry) && secondsToExpiry < SIXTY_DAYS_SECONDS) {
    const days = Math.max(0, Math.floor(secondsToExpiry / (24 * 60 * 60)))
    logWarn(`Access token expires in less than 60 days (${days} days remaining).`)
  }

  const scopes = normalizeScopes(data)
  const hasWhatsAppMessaging = scopes.includes("whatsapp_business_messaging")

  if (!hasWhatsAppMessaging) {
    logFail("Missing required permission: whatsapp_business_messaging.")
    return
  }

  logInfo("PASS: Token includes whatsapp_business_messaging permission.")
}

async function main() {
  logInfo("Starting environment checks for WhatsApp webhook deployment.")

  checkRequired()
  if (process.exitCode) return

  const tokenData = await debugToken()
  if (!tokenData) return

  evaluateToken(tokenData)
}

main().catch((error) => {
  logFail(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`)
})

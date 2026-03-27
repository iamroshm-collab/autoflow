const required = {
  META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: String(process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim(),
  WHATSAPP_ACCESS_TOKEN: String(process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim(),
}

const has = (value) => Boolean(String(value || "").trim())

const warn = (message) => {
  console.warn(`[ENV_CHECK][WARN] ${message}`)
}

const info = (message) => {
  console.log(`[ENV_CHECK] ${message}`)
}

const fail = (message) => {
  console.error(`[ENV_CHECK][ERROR] ${message}`)
  process.exitCode = 1
}

const detectLikelyTokenRisk = (token) => {
  const cleaned = String(token || "").trim()
  const warnings = []

  if (!cleaned) {
    warnings.push("Access token is empty.")
    return warnings
  }

  if (cleaned.includes("|")) {
    warnings.push("Token looks like an App token (contains '|'), not a WhatsApp access token.")
  }

  if (!cleaned.startsWith("EAA")) {
    warnings.push("Token does not start with 'EAA' (unexpected format for Meta Graph tokens).")
  }

  if (cleaned.length < 120) {
    warnings.push("Token length is short; this is often a short-lived user token.")
  }

  return warnings
}

const validateViaDebugToken = async (token) => {
  const appId = String(process.env.META_APP_ID || "").trim()
  const appSecret = String(process.env.META_APP_SECRET || "").trim()

  if (!appId || !appSecret) {
    warn("META_APP_ID/META_APP_SECRET not set. Skipping debug_token introspection.")
    return
  }

  const appAccessToken = `${appId}|${appSecret}`
  const url = `https://graph.facebook.com/v20.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appAccessToken)}`

  try {
    const response = await fetch(url)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      warn(`debug_token failed (${response.status}). Response: ${JSON.stringify(data)}`)
      return
    }

    const tokenData = data?.data || {}
    const type = String(tokenData.type || "").toUpperCase()
    const isValid = Boolean(tokenData.is_valid)
    const expiresAt = Number(tokenData.expires_at || 0)
    const nowUnix = Math.floor(Date.now() / 1000)

    if (!isValid) {
      fail("debug_token reports WHATSAPP_ACCESS_TOKEN is invalid.")
      return
    }

    info(`debug_token type=${type || "unknown"}`)

    if (type && type !== "SYSTEM_USER") {
      warn(`Token type is ${type}, not SYSTEM_USER. Prefer a permanent System User token for production webhooks.`)
    }

    if (expiresAt > 0 && expiresAt < nowUnix + 60 * 60 * 24 * 30) {
      warn("Token expires within 30 days. This is not a long-lived permanent system token.")
    }

    if (expiresAt === 0) {
      info("Token appears non-expiring (expires_at=0).")
    }
  } catch (error) {
    warn(`debug_token request failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  info("Checking required WhatsApp webhook environment variables...")

  if (!has(required.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN)) {
    fail("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN is missing.")
  } else {
    info("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN is set.")
  }

  if (!has(required.WHATSAPP_ACCESS_TOKEN)) {
    fail("WHATSAPP_ACCESS_TOKEN is missing (or META_WHATSAPP_ACCESS_TOKEN fallback is not set).")
  } else {
    info("WHATSAPP_ACCESS_TOKEN is set.")

    const heuristics = detectLikelyTokenRisk(required.WHATSAPP_ACCESS_TOKEN)
    heuristics.forEach((message) => warn(message))

    await validateViaDebugToken(required.WHATSAPP_ACCESS_TOKEN)
  }

  if (process.exitCode && process.exitCode !== 0) {
    fail("Environment check failed.")
    return
  }

  info("Environment check completed.")
}

main().catch((error) => {
  fail(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`)
})
const DEVICE_ID_KEY = "autoflow_device_id"
const DEVICE_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5

const readDeviceIdFromCookie = () => {
  if (typeof document === "undefined") {
    return ""
  }

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DEVICE_ID_KEY}=`))

  if (!cookie) {
    return ""
  }

  const value = cookie.slice(`${DEVICE_ID_KEY}=`.length).trim()
  return decodeURIComponent(value)
}

const writeDeviceIdCookie = (value: string) => {
  if (typeof document === "undefined") {
    return
  }

  const encodedValue = encodeURIComponent(value)
  document.cookie = `${DEVICE_ID_KEY}=${encodedValue}; Max-Age=${DEVICE_ID_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`
}

const buildDeviceId = () => {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

  return `web-${randomPart.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)}`
}

export const getOrCreateDeviceId = () => {
  if (typeof window === "undefined") {
    return ""
  }

  const cookieValue = String(readDeviceIdFromCookie() || "").trim()
  if (cookieValue) {
    localStorage.setItem(DEVICE_ID_KEY, cookieValue)
    return cookieValue
  }

  const existing = String(localStorage.getItem(DEVICE_ID_KEY) || "").trim()
  if (existing) {
    writeDeviceIdCookie(existing)
    return existing
  }

  const created = buildDeviceId()
  localStorage.setItem(DEVICE_ID_KEY, created)
  writeDeviceIdCookie(created)
  return created
}

export const clearStoredDeviceId = () => {
  if (typeof window === "undefined") {
    return
  }

  localStorage.removeItem(DEVICE_ID_KEY)
  if (typeof document !== "undefined") {
    document.cookie = `${DEVICE_ID_KEY}=; Max-Age=0; Path=/; SameSite=Lax`
  }
}

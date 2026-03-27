"use client"

let oneSignalInitPromise: Promise<any> | null = null

const getOneSignal = async () => {
  const module = await import("react-onesignal")
  return module.default as any
}

const getOneSignalAppId = () => String(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "").trim()
const getAllowedOrigins = () => {
  const raw = String(process.env.NEXT_PUBLIC_ONESIGNAL_ALLOWED_ORIGINS || "https://autoflowindia.com,http://localhost:3000,http://127.0.0.1:3000")
  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, "").toLowerCase())
    .filter(Boolean)
}

const isImplicitlyAllowedOrigin = (origin: string) => {
  try {
    const parsed = new URL(origin)
    const host = parsed.hostname.toLowerCase()
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".trycloudflare.com")
  } catch {
    return false
  }
}

const isOneSignalOriginAllowed = () => {
  if (typeof window === "undefined") {
    return false
  }

  const currentOrigin = window.location.origin.trim().replace(/\/+$/, "").toLowerCase()
  return getAllowedOrigins().includes(currentOrigin) || isImplicitlyAllowedOrigin(currentOrigin)
}

export const isOneSignalReady = () => Boolean(getOneSignalAppId())

export const initOneSignal = async () => {
  if (!isOneSignalReady() || typeof window === "undefined" || !isOneSignalOriginAllowed()) {
    return null
  }

  if (oneSignalInitPromise) {
    return oneSignalInitPromise
  }

  oneSignalInitPromise = (async () => {
    const OneSignal = await getOneSignal()

    await OneSignal.init({
      appId: getOneSignalAppId(),
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: "/OneSignalSDKWorker.js",
      serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
      notifyButton: { enable: false },
    })

    return OneSignal
  })()

  return oneSignalInitPromise
}

export const getOneSignalPlayerId = async () => {
  const OneSignal = await initOneSignal()
  if (!OneSignal) {
    return null
  }

  return (
    OneSignal.User?.PushSubscription?.id ||
    (typeof OneSignal.getUserId === "function" ? await OneSignal.getUserId() : null) ||
    null
  )
}

const waitForOneSignalPlayerId = async (timeoutMs = 7000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const playerId = await getOneSignalPlayerId()
    if (playerId) {
      return playerId
    }
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
  return null
}

export const requestPushPermissionAndRegister = async (employeeId: number) => {
  const OneSignal = await initOneSignal()
  if (!OneSignal) {
    if (!isOneSignalReady()) {
      throw new Error("Push notifications are not configured (missing NEXT_PUBLIC_ONESIGNAL_APP_ID)")
    }
    if (typeof window !== "undefined" && !isOneSignalOriginAllowed()) {
      throw new Error(`Push notifications are not enabled for this site origin: ${window.location.origin}`)
    }
    throw new Error("OneSignal failed to initialize")
  }

  const permission = await Promise.resolve(OneSignal.Notifications?.permission)
  if (permission !== "granted") {
    await OneSignal.Notifications.requestPermission()
  }

  const latestPermission = await Promise.resolve(OneSignal.Notifications?.permission)
  if (latestPermission !== "granted") {
    throw new Error("Notification permission was not granted")
  }

  const playerId = await waitForOneSignalPlayerId()
  if (!playerId) {
    throw new Error("Unable to read OneSignal device ID")
  }

  const response = await fetch("/api/notifications/device-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, oneSignalPlayerId: playerId }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(data?.error || "Failed to register OneSignal device"))
  }

  return playerId
}

export const setupForegroundPushListener = async () => {
  const OneSignal = await initOneSignal()
  if (!OneSignal?.Notifications?.addEventListener) {
    return () => undefined
  }

  const listener = (event: any) => {
    const notification = event?.notification
    if (notification && typeof notification.display === "function") {
      notification.display()
    }
  }

  OneSignal.Notifications.addEventListener("foregroundWillDisplay", listener)

  return () => {
    OneSignal.Notifications.removeEventListener?.("foregroundWillDisplay", listener)
  }
}

export const enableApprovalPushAlias = async (externalId: string) => {
  const normalizedExternalId = String(externalId || "").trim().toLowerCase()
  if (!normalizedExternalId) {
    throw new Error("External ID is required to enable approval notifications")
  }

  const OneSignal = await initOneSignal()
  if (!OneSignal) {
    throw new Error("OneSignal failed to initialize")
  }

  try {
    if (typeof OneSignal.login === "function") {
      await OneSignal.login(normalizedExternalId)
    } else if (typeof OneSignal.User?.addAlias === "function") {
      await OneSignal.User.addAlias("external_id", normalizedExternalId)
    }
  } catch (aliasError) {
    console.warn("[ONESIGNAL_ALIAS_BIND_FAILED]", aliasError)
  }

  const permission = await Promise.resolve(OneSignal.Notifications?.permission)
  if (permission !== "granted") {
    await OneSignal.Notifications.requestPermission()
  }

  const latestPermission = await Promise.resolve(OneSignal.Notifications?.permission)
  if (latestPermission !== "granted") {
    throw new Error("Notification permission was not granted")
  }

  return waitForOneSignalPlayerId(7000)
}
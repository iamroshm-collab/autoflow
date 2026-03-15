const firebaseWebConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const firebaseVapidKey =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  "BKTj6we0u919GlMloRi50hOBgMoz9DYk9xaXS86jnKq5BKNjKgvoT_Dn6-3ehhtqTnf80Wv9ru2xizmCvcWO3aY"

let foregroundUnsubscribe: (() => void) | null = null

function hasFirebaseClientConfig() {
  return Boolean(
    firebaseWebConfig.apiKey &&
      firebaseWebConfig.authDomain &&
      firebaseWebConfig.projectId &&
      firebaseWebConfig.storageBucket &&
      firebaseWebConfig.messagingSenderId &&
      firebaseWebConfig.appId &&
      firebaseVapidKey
  )
}

export async function registerTechnicianPushToken(technicianId: number) {
  if (!Number.isInteger(technicianId) || technicianId <= 0) {
    throw new Error("Invalid technician ID")
  }

  if (typeof window === "undefined") {
    throw new Error("Push notifications are available only in browser")
  }

  if (!window.isSecureContext) {
    throw new Error("Push notifications require HTTPS (or localhost)")
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("This browser does not support push notifications")
  }

  if (!hasFirebaseClientConfig()) {
    throw new Error("Firebase web config is missing. Set NEXT_PUBLIC_FIREBASE_* env vars")
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted")
  }

  const { initializeApp, getApp, getApps } = await import("firebase/app")
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging")

  const supported = await isSupported().catch(() => false)
  if (!supported) {
    throw new Error("Firebase messaging is not supported in this browser")
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseWebConfig)

  // Service worker path required by Firebase Messaging for web push.
  const serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")

  const messaging = getMessaging(app)
  const token = await getToken(messaging, {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration,
  })

  if (!token) {
    throw new Error("Unable to generate FCM device token")
  }

  const response = await fetch("/api/register-device-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      technicianId,
      token,
      deviceType: /android|iphone|ipad|mobile/i.test(navigator.userAgent) ? "mobile-web" : "web",
    }),
  })

  const data = await response.json()
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to save device token")
  }

  return token
}

export async function setupTechnicianPushForegroundListener() {
  if (typeof window === "undefined") {
    return null
  }

  if (!("Notification" in window)) {
    return null
  }

  if (!hasFirebaseClientConfig()) {
    return null
  }

  const { initializeApp, getApp, getApps } = await import("firebase/app")
  const { getMessaging, isSupported, onMessage } = await import("firebase/messaging")

  const supported = await isSupported().catch(() => false)
  if (!supported) {
    return null
  }

  if (foregroundUnsubscribe) {
    return foregroundUnsubscribe
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseWebConfig)
  const messaging = getMessaging(app)

  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    if (Notification.permission !== "granted") {
      return
    }

    const title = payload.notification?.title || (payload.data as any)?.title || "New Job Assigned"
    const vehicleNumber = (payload.data as any)?.vehicleNumber || ''
    const taskAssigned = (payload.data as any)?.taskAssigned || ''
    const fallbackBody = vehicleNumber
      ? `Vehicle: ${vehicleNumber}${taskAssigned ? ` | Task: ${taskAssigned}` : ''}`
      : 'You have a new job update'
    const body = payload.notification?.body || (payload.data as any)?.body || fallbackBody

    // Explicitly show foreground notifications; FCM does not auto-render them on web.
    new Notification(title, {
      body,
      icon: "/favicon.ico",
    })
  })

  return foregroundUnsubscribe
}

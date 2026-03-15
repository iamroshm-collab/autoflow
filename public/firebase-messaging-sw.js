/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  if (!event.data) {
    return
  }

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = {}
  }

  const notification = payload.notification || {}
  const data = payload.data || {}
  const title = notification.title || data.title || "New Job Assigned"
  const vehicleNumber = data.vehicleNumber || ''
  const taskAssigned = data.taskAssigned || ''
  const fallbackBody = vehicleNumber
    ? `Vehicle: ${vehicleNumber}${taskAssigned ? ` | Task: ${taskAssigned}` : ''}`
    : 'You have a new job update'
  const body = notification.body || data.body || fallbackBody

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || "/technician"
  event.waitUntil(self.clients.openWindow(targetUrl))
})

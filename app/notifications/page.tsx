"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

type AppNotification = {
  id: string
  title: string
  body: string
  type: string
  url?: string | null
  targetForm?: string | null
  isRead: boolean
  createdAt: string
  refType?: string | null
  refId?: string | null
}

export default function NotificationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/notifications?includeRead=true&limit=100", { cache: "no-store" })
      if (response.status === 401) {
        router.replace("/login")
        return
      }

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch notifications")
      }

      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to fetch notifications")
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" })
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)))
    } catch (error) {
      console.error("[NOTIFICATIONS_MARK_READ]", error)
    }
  }

  const openNotification = async (item: AppNotification) => {
    if (!item.isRead) {
      await markRead(item.id)
    }

    if (item.targetForm) {
      router.push(`/?form=${encodeURIComponent(item.targetForm)}`)
      return
    }

    if (item.url) {
      // For approvals, prefer opening the specific request if ref info exists
      if (item.url === "/approvals") {
        if (item.refId) {
          router.push(`/approvals?userId=${encodeURIComponent(item.refId)}`)
          return
        }
        // try to extract mobile from body
        const m = (item.body || "").match(/\b(\d{10})\b/)?.[1]
        if (m) {
          router.push(`/approvals?mobile=${encodeURIComponent(m)}`)
          return
        }
      }

      router.push(item.url)
    }
  }

  const deleteNotification = async (id: string) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/notifications/${id}`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete notification")
      }
      setNotifications((prev) => prev.filter((item) => item.id !== id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete")
    } finally {
      setBusy(false)
    }
  }

  const deleteAllRead = async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/notifications?mode=read", { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete read notifications")
      }
      setNotifications((prev) => prev.filter((item) => !item.isRead))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete read notifications")
    } finally {
      setBusy(false)
    }
  }

  const deleteAll = async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/notifications?mode=all", { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete all notifications")
      }
      setNotifications([])
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete all notifications")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">All Notifications</h1>
            <p className="text-sm text-slate-500">Manage read and unread notifications.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/")}>Back</Button>
            <Button variant="outline" disabled={busy} onClick={deleteAllRead}>Delete Read</Button>
            <Button variant="destructive" disabled={busy} onClick={deleteAll}>Delete All</Button>
          </div>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications found.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${item.isRead ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-blue-50/50"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openNotification(item)}
                    className="text-left flex-1"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-700 mt-1">{item.body}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    {!item.isRead ? (
                      <Button size="sm" variant="outline" onClick={() => markRead(item.id)} disabled={busy}>
                        Mark Read
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteNotification(item.id)}
                      disabled={busy}
                      aria-label="Delete notification"
                      title="Delete"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

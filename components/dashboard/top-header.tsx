"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Bell, Mail, Settings, UserCircle, Menu } from "lucide-react"
import { type UserRole } from "@/lib/access-control"

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.49 2 2 6.37 2 11.75c0 1.95.6 3.84 1.74 5.45L2.5 22l4.98-1.2A10.1 10.1 0 0 0 12 21.5c5.51 0 10-4.37 10-9.75S17.51 2 12 2Zm0 17.71c-1.5 0-2.97-.39-4.27-1.12l-.31-.18-2.95.71.79-2.82-.2-.31a7.64 7.64 0 0 1-1.23-4.24c0-4.27 3.67-7.74 8.17-7.74s8.17 3.47 8.17 7.74-3.66 7.96-8.17 7.96Zm4.57-5.98c-.25-.12-1.47-.71-1.69-.79-.23-.09-.39-.12-.56.12-.17.24-.65.79-.79.95-.15.15-.29.17-.54.06-.25-.12-1.07-.38-2.03-1.2a7.5 7.5 0 0 1-1.4-1.69c-.15-.24-.02-.37.1-.48.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.18.04-.33-.02-.46-.06-.12-.56-1.34-.77-1.84-.2-.47-.41-.41-.56-.42h-.48c-.17 0-.46.06-.7.33-.24.27-.91.89-.91 2.17s.93 2.51 1.05 2.69c.12.17 1.82 2.79 4.4 3.9.62.27 1.11.43 1.49.55.62.2 1.19.17 1.64.1.5-.08 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  )
}

type HeaderNotification = {
  id: string
  title: string
  body: string
  type: string
  url?: string | null
  targetForm?: string | null
  isRead: boolean
  createdAt: string
}

type WhatsAppMessage = {
  status?: string | null
}

type WhatsAppMessagesResponse = {
  messages?: WhatsAppMessage[]
}

const isUnreadWhatsAppStatus = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toLowerCase()
  return normalized.includes("receive") || normalized.includes("new")
}

interface TopHeaderProps {
  onToggleSidebar?: () => void
  onSettings?: () => void
  onWhatsApp?: () => void
  heading?: ReactNode
  userName?: string
  userRole?: UserRole
  onNotificationNavigate?: (targetForm: string) => void
  onLogout?: () => void
}

export function TopHeader({
  onToggleSidebar,
  onSettings,
  onWhatsApp,
  heading,
  userName,
  userRole,
  onNotificationNavigate,
  onLogout,
}: TopHeaderProps) {
  const [notifications, setNotifications] = useState<HeaderNotification[]>([])
  const [whatsAppUnreadCount, setWhatsAppUnreadCount] = useState(0)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const hasLoggedNotificationsFetchError = useRef(false)

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  )

  useEffect(() => {
    let mounted = true
    let knownIds = new Set<string>()

    const loadNotifications = async () => {
      try {
        const [notificationsResponse, whatsAppResponse] = await Promise.all([
          fetch("/api/notifications?limit=25", { cache: "no-store" }),
          fetch("/api/admin/messages", { cache: "no-store" }),
        ])

        if (!notificationsResponse.ok) {
          return
        }

        const data = await notificationsResponse.json()
        const rows = Array.isArray(data.notifications) ? data.notifications : []

        if (whatsAppResponse.ok) {
          const whatsAppData = (await whatsAppResponse.json()) as WhatsAppMessagesResponse
          const whatsAppRows = Array.isArray(whatsAppData.messages) ? whatsAppData.messages : []
          const unreadCount = new Set(
            whatsAppRows
              .filter((item) => isUnreadWhatsAppStatus(item.status) && item.phoneNumber)
              .map((item) => item.phoneNumber as string)
          ).size
          if (mounted) {
            setWhatsAppUnreadCount(unreadCount)
          }
        }

        if (!mounted) {
          return
        }

        setNotifications(rows)
  hasLoggedNotificationsFetchError.current = false

        if (typeof window !== "undefined" && "Notification" in window) {
          const newUnread = rows.filter((item: HeaderNotification) => !item.isRead && !knownIds.has(item.id))
          for (const item of newUnread) {
            knownIds.add(item.id)
            if (Notification.permission === "granted") {
              new Notification(item.title, { body: item.body })
            }
          }
        }
      } catch (error) {
        const isNetworkFetchError = error instanceof TypeError
          && String(error.message || "").toLowerCase().includes("failed to fetch")

        if (isNetworkFetchError) {
          // Transient network hiccups should not flood the console during polling.
          if (!hasLoggedNotificationsFetchError.current) {
            console.warn("[HEADER_NOTIFICATIONS_LOAD] Notifications endpoint temporarily unreachable")
            hasLoggedNotificationsFetchError.current = true
          }
          return
        }

        console.error("[HEADER_NOTIFICATIONS_LOAD]", error)
      }
    }

    void loadNotifications()

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission()
    }

    const interval = window.setInterval(loadNotifications, 15000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  const openNotification = async (item: HeaderNotification) => {
    try {
      if (!item.isRead) {
        await fetch(`/api/notifications/${item.id}`, {
          method: "PATCH",
        })
        setNotifications((prev) => prev.filter((row) => row.id !== item.id))
      }
    } catch (error) {
      console.error("[HEADER_NOTIFICATION_READ]", error)
    }

    setIsNotificationOpen(false)

    if (item.targetForm && onNotificationNavigate) {
      onNotificationNavigate(item.targetForm)
      return
    }

    if (item.url) {
      window.location.href = item.url
    }
  }

  const clearAllNotifications = async () => {
    try {
      const response = await fetch("/api/notifications?mode=all", {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to clear notifications")
      }

      setNotifications([])
    } catch (error) {
      console.error("[HEADER_NOTIFICATION_CLEAR_ALL]", error)
    }
  }

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-[#000F48] text-sidebar-foreground border-b border-sidebar-border shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors group"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-sidebar-foreground/70 group-hover:text-black" />
        </button>
        {heading || null}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            className="relative p-2 rounded-lg hover:bg-sidebar-accent transition-colors group"
            aria-label="Notifications"
            onClick={() => setIsNotificationOpen((prev) => !prev)}
          >
            <Bell className="w-5 h-5 text-sidebar-foreground/70 group-hover:text-black" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
          {isNotificationOpen ? (
            <div className="absolute right-0 mt-2 w-96 max-w-[80vw] rounded-lg border border-slate-200 bg-white text-slate-900 shadow-lg z-50">
              <div className="px-3 py-2 border-b border-slate-200 text-sm font-semibold">Notifications</div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500">No notifications yet.</div>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openNotification(item)}
                      className={`w-full text-left px-3 py-3 border-b border-slate-100 hover:bg-slate-50 ${!item.isRead ? "bg-blue-50/50" : ""}`}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{item.body}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-slate-200 p-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  className="w-full rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationOpen(false)
                    window.location.href = "/notifications"
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  View All
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <button className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors group" aria-label="Messages">
          <Mail className="w-5 h-5 text-sidebar-foreground/70 group-hover:text-black" />
        </button>
        <button
          onClick={onWhatsApp}
          className="relative p-2 rounded-lg hover:bg-sidebar-accent transition-colors group"
          aria-label="WhatsApp Form"
          title="WhatsApp Form"
        >
          <WhatsAppIcon className="w-5 h-5 text-sidebar-foreground/70 group-hover:text-black" />
          {whatsAppUnreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
              {whatsAppUnreadCount > 9 ? "9+" : whatsAppUnreadCount}
            </span>
          ) : null}
        </button>
        {userRole === "admin" ? (
          <button
            onClick={onSettings}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors group"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-sidebar-foreground/70 group-hover:text-black" />
          </button>
        ) : null}
        <div className="flex items-center gap-2 pl-3 border-l border-sidebar-border">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-sidebar-foreground/70" />
          </div>
          <div className="hidden md:flex md:flex-col">
            <span className="text-sm font-medium">Hi, {userName || "User"}</span>
            <button
              type="button"
              onClick={onLogout}
              className="text-left text-xs text-sidebar-foreground/70 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

"use client"

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { Bell, Search, UserCircle, Menu, X } from "lucide-react"
import { type UserRole } from "@/lib/access-control"
import { Input } from "@/components/ui/input"

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

type WhatsAppMessage = { status?: string | null; phoneNumber?: string | null }
type WhatsAppMessagesResponse = { messages?: WhatsAppMessage[] }

const isUnreadWhatsAppStatus = (status: string | null | undefined) => {
  const n = String(status || "").trim().toLowerCase()
  return n.includes("receive") || n.includes("new") || n === ""
}

export type TopBarSearchConfig = {
  placeholder: string
  value: string
  onChange: (value: string) => void
  suffix?: ReactNode
}

interface TopBarProps {
  pageTitle: string
  pageIcon?: React.ElementType
  pageSubtitle?: string
  searchConfig?: TopBarSearchConfig
  customSearch?: ReactNode
  userName?: string
  userRole?: UserRole
  whatsAppAllowed?: boolean
  onWhatsApp?: () => void
  onNotificationNavigate?: (targetForm: string) => void
  onToggleSidebar?: () => void
  searchInputRef?: RefObject<HTMLInputElement | null>
  onSearchFocusChange?: (focused: boolean) => void
  showMobileActionIcons?: boolean
}

export function TopBar({
  pageTitle,
  pageIcon: PageIcon,
  pageSubtitle,
  searchConfig,
  customSearch,
  userName,
  userRole,
  whatsAppAllowed,
  onWhatsApp,
  onNotificationNavigate,
  onToggleSidebar,
  searchInputRef,
  onSearchFocusChange,
  showMobileActionIcons = false,
}: TopBarProps) {
  const [notifications, setNotifications] = useState<HeaderNotification[]>([])
  const [whatsAppUnreadCount, setWhatsAppUnreadCount] = useState(0)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const hasLoggedError = useRef(false)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [nr, wr] = await Promise.all([
          fetch("/api/notifications?limit=25", { cache: "no-store" }),
          fetch("/api/admin/messages", { cache: "no-store" }),
        ])
        if (!nr.ok) return
        const data = await nr.json()
        const rows: HeaderNotification[] = Array.isArray(data.notifications) ? data.notifications : []
        if (wr.ok) {
          const wd = (await wr.json()) as WhatsAppMessagesResponse
          const wRows = Array.isArray(wd.messages) ? wd.messages : []
          // Count unique contacts with at least one unread/unreplied message
          const unreadPhones = new Set(
            wRows
              .filter((m) => isUnreadWhatsAppStatus(m.status) && m.phoneNumber)
              .map((m) => m.phoneNumber as string)
          )
          if (mounted) setWhatsAppUnreadCount(unreadPhones.size)
        }
        if (mounted) { setNotifications(rows); hasLoggedError.current = false }
      } catch (err) {
        if (!hasLoggedError.current) { console.warn("[TOPBAR]", err); hasLoggedError.current = true }
      }
    }
    void load()
    const t = window.setInterval(load, 15000)
    return () => { mounted = false; window.clearInterval(t) }
  }, [])

  const handleNotificationClick = async (item: HeaderNotification) => {
    try {
      if (!item.isRead) {
        await fetch(`/api/notifications/${item.id}`, { method: "PATCH" })
        setNotifications((prev) => prev.filter((r) => r.id !== item.id))
      }
    } catch {}
    if (item.targetForm && onNotificationNavigate) {
      onNotificationNavigate(item.targetForm)
    } else if (item.url) {
      window.location.href = item.url
    } else if (onNotificationNavigate) {
      onNotificationNavigate("all-notifications")
    } else {
      window.location.href = "/notifications"
    }
  }

  const goToNotifications = () => {
    if (onNotificationNavigate) {
      onNotificationNavigate("all-notifications")
    } else {
      window.location.href = "/notifications"
    }
  }

  return (
    <header className="w-full flex items-center gap-4 h-14 px-4 bg-white border border-slate-100 shrink-0 rounded-2xl">
      {/* Mobile menu toggle */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5 text-slate-500" />
      </button>

      {/* Page title — hidden on mobile when search is open */}
      <div className={`flex items-center gap-2 shrink-0 ${mobileSearchOpen ? "hidden" : ""}`}>
        {PageIcon && <PageIcon className="w-5 h-5 text-slate-400" />}
        <h1 className="text-base font-semibold text-slate-800 whitespace-nowrap">{pageTitle}</h1>
        {pageSubtitle && (
          <>
            <span className="text-slate-300 text-sm">›</span>
            <span className="text-sm font-medium text-slate-500 whitespace-nowrap">{pageSubtitle}</span>
          </>
        )}
      </div>

      <div className={mobileSearchOpen ? "hidden" : "flex-1"} />

      {/* Search — context-aware, pinned to right before action icons */}
      {searchConfig ? (
        <>
          {/* Mobile: icon toggles search input */}
          <div className={`sm:hidden flex items-center ${mobileSearchOpen ? "flex-1" : ""}`}>
            {mobileSearchOpen ? (
              <div className="flex items-center gap-1 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    ref={searchInputRef}
                    autoFocus
                    value={searchConfig.value}
                    onChange={(e) => searchConfig.onChange(e.target.value)}
                    onFocus={() => onSearchFocusChange?.(true)}
                    onBlur={() => onSearchFocusChange?.(false)}
                    placeholder={searchConfig.placeholder}
                    className="global-topbar-search !pl-8"
                  />
                </div>
                <button
                  onClick={() => { setMobileSearchOpen(false); searchConfig.onChange("") }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  aria-label="Close search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setMobileSearchOpen(true)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>
          {/* Desktop: always show full search */}
          <div className="hidden sm:flex items-center gap-2">
            {searchConfig.suffix ?? null}
            <div className="relative w-[17.5rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                ref={searchInputRef}
                value={searchConfig.value}
                onChange={(e) => searchConfig.onChange(e.target.value)}
                onFocus={() => onSearchFocusChange?.(true)}
                onBlur={() => onSearchFocusChange?.(false)}
                placeholder={searchConfig.placeholder}
                className="global-topbar-search pl-8"
              />
            </div>
          </div>
        </>
      ) : null}
      {customSearch ? (
        <>
          {/* Mobile: icon toggles full-width customSearch */}
          <div className={`sm:hidden flex items-center ${mobileSearchOpen ? "flex-1" : ""}`}>
            {mobileSearchOpen ? (
              <div className="flex items-center gap-1 w-full">
                <div className="flex-1 min-w-0 [&>*]:!w-full [&>*>*]:!w-full [&>*>*>input]:!pl-8">
                  {customSearch}
                </div>
                <button
                  onClick={() => setMobileSearchOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 shrink-0"
                  aria-label="Close search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setMobileSearchOpen(true)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>
          {/* Desktop: always show */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {customSearch}
          </div>
        </>
      ) : null}

      {/* Action icons — hidden on mobile when search is open */}
      <div className={`flex items-center gap-0 ${mobileSearchOpen ? "hidden sm:flex" : ""}`}>

        {/* WhatsApp */}
        {whatsAppAllowed && (
          <button
            onClick={onWhatsApp}
            className={`relative p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 ${showMobileActionIcons ? "" : "hidden sm:flex"}`}
            title="WhatsApp Messages"
          >
            <WhatsAppIcon className="w-5 h-5" />
            {whatsAppUnreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
                {whatsAppUnreadCount > 9 ? "9+" : whatsAppUnreadCount}
              </span>
            )}
          </button>
        )}

        {/* Notifications — click goes directly to notifications page / form */}
        <button
          onClick={goToNotifications}
          className={`relative p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 ${showMobileActionIcons ? "" : "hidden sm:flex"}`}
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User info (read-only, no logout) */}
        <div className="flex items-center gap-2 ml-1 pl-2 border-l border-slate-100">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <UserCircle className="w-5 h-5 text-slate-400" />
          </div>
          <div className="hidden md:flex md:flex-col leading-tight">
            <span className="text-sm font-semibold text-slate-700">{userName || "User"}</span>
            <span className="text-xs text-slate-400 capitalize">{userRole || ""}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

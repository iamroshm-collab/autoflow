"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import Image from "next/image"
import {
  Bell,
  Search,
  UserCircle,
  Menu,
  X,
  CalendarCheck,
  Wrench,
  Smartphone,
  LogOut,
  ChevronRight,
  Settings,
  Home,
} from "lucide-react"
import { type UserRole } from "@/lib/access-control"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { normalizeMobileNumber } from "@/lib/mobile-validation"

// ── WhatsApp Icon ────────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.49 2 2 6.37 2 11.75c0 1.95.6 3.84 1.74 5.45L2.5 22l4.98-1.2A10.1 10.1 0 0 0 12 21.5c5.51 0 10-4.37 10-9.75S17.51 2 12 2Zm0 17.71c-1.5 0-2.97-.39-4.27-1.12l-.31-.18-2.95.71.79-2.82-.2-.31a7.64 7.64 0 0 1-1.23-4.24c0-4.27 3.67-7.74 8.17-7.74s8.17 3.47 8.17 7.74-3.66 7.96-8.17 7.96Zm4.57-5.98c-.25-.12-1.47-.71-1.69-.79-.23-.09-.39-.12-.56.12-.17.24-.65.79-.79.95-.15.15-.29.17-.54.06-.25-.12-1.07-.38-2.03-1.2a7.5 7.5 0 0 1-1.4-1.69c-.15-.24-.02-.37.1-.48.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.18.04-.33-.02-.46-.06-.12-.56-1.34-.77-1.84-.2-.47-.41-.41-.56-.42h-.48c-.17 0-.46.06-.7.33-.24.27-.91.89-.91 2.17s.93 2.51 1.05 2.69c.12.17 1.82 2.79 4.4 3.9.62.27 1.11.43 1.49.55.62.2 1.19.17 1.64.1.5-.08 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

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

type AssignedJobSummary = {
  id: string
  jobId: string
  status: string
  assignedAt: string
  jobCard: {
    jobCardNumber: string
    vehicle: { registrationNumber: string; make: string; model: string }
    customer: { name: string }
  }
}

type WhatsAppMessage = { status?: string | null; phoneNumber?: string | null }
type WhatsAppMessagesResponse = { messages?: WhatsAppMessage[] }

const isUnreadWhatsAppStatus = (status: string | null | undefined) => {
  const n = String(status || "").trim().toLowerCase()
  return n.includes("receive") || n.includes("new")
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
  userMobile?: string | null
  employeePhotoUrl?: string | null
  whatsAppAllowed?: boolean
  settingsAllowed?: boolean
  onWhatsApp?: () => void
  onSettings?: () => void
  onAttendance?: () => void
  onOpenAssignedJob?: (jobId: string) => void
  onNotificationNavigate?: (targetForm: string) => void
  onToggleSidebar?: () => void
  onLogout?: () => void
  onNavigateDashboard?: () => void
  searchInputRef?: RefObject<HTMLInputElement | null>
  onSearchFocusChange?: (focused: boolean) => void
}

// ── De-register modal ─────────────────────────────────────────────────────────

function DeregisterModal({
  mobile,
  onClose,
  onLogout,
}: {
  mobile: string
  onClose: () => void
  onLogout?: () => void
}) {
  const [phase, setPhase] = useState<"idle" | "otp">("idle")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const requestOtp = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/deregister-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send OTP")
      setPhase("otp")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP")
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/deregister-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp, verifyOtp: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "OTP verification failed")
      setSuccess(true)
      setTimeout(() => { onLogout?.() }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-3 w-72">
      {success ? (
        <p className="text-sm text-emerald-600 font-medium text-center py-2">
          Device de-registered. Logging out…
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            This will remove this device from your account. You will need admin approval to log in again on a new device.
          </p>
          {phase === "idle" && (
            <Button
              size="sm"
              variant="destructive"
              className="w-full gap-1.5"
              onClick={() => void requestOtp()}
              disabled={loading}
            >
              <Smartphone className="w-3.5 h-3.5" />
              {loading ? "Sending OTP…" : "Send OTP to WhatsApp"}
            </Button>
          )}
          {phase === "otp" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">Enter the 6-digit OTP sent to your WhatsApp.</p>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                className="text-center tracking-widest"
              />
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                onClick={() => void verifyOtp()}
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying…" : "Confirm De-register"}
              </Button>
              <button
                type="button"
                className="w-full text-xs text-slate-400 hover:text-slate-600 py-1"
                onClick={() => { setPhase("idle"); setOtp("") }}
              >
                Back
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            className="w-full text-xs text-slate-400 hover:text-slate-600 text-center py-1 border-t border-slate-100 mt-1"
            onClick={onClose}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  )
}

// ── Employee DP button + anchored modal ───────────────────────────────────────

function EmployeeDpButton({
  photoUrl,
  userName,
  mobile,
  onNavigateDashboard,
  onLogout,
}: {
  photoUrl?: string | null
  userName?: string
  mobile?: string | null
  onNavigateDashboard?: () => void
  onLogout?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"menu" | "deregister">("menu")
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setTab("menu") }
  }, [open])

  useEffect(() => {
    const handler = (e: Event) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [])

  const normalizedMobile = mobile ? normalizeMobileNumber(mobile) : ""

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-72 rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
          {/* Profile header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={userName || "Profile"}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-slate-400" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{userName || "Employee"}</p>
              <p className="text-xs text-slate-500">{normalizedMobile || "—"}</p>
            </div>
          </div>

          {tab === "menu" && (
            <div className="py-1">
              {onNavigateDashboard && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onNavigateDashboard()
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Home className="w-4 h-4 shrink-0" />
                  <span>Dashboard</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-300" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setTab("deregister")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>De-register device</span>
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-300" />
              </button>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          )}

          {tab === "deregister" && normalizedMobile && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-600"
                  onClick={() => setTab("menu")}
                >
                  ← Back
                </button>
                <span className="text-xs font-semibold text-slate-600">De-register Device</span>
              </div>
              <DeregisterModal
                mobile={normalizedMobile}
                onClose={() => setOpen(false)}
                onLogout={onLogout}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar({
  pageTitle,
  pageIcon: PageIcon,
  pageSubtitle,
  searchConfig,
  customSearch,
  userName,
  userRole,
  userMobile,
  employeePhotoUrl,
  whatsAppAllowed,
  settingsAllowed,
  onWhatsApp,
  onSettings,
  onAttendance,
  onOpenAssignedJob,
  onNotificationNavigate,
  onToggleSidebar,
  onLogout,
  onNavigateDashboard,
  searchInputRef,
  onSearchFocusChange,
}: TopBarProps) {
  const [notifications, setNotifications] = useState<HeaderNotification[]>([])
  const [assignedJobs, setAssignedJobs] = useState<AssignedJobSummary[]>([])
  const [whatsAppUnreadCount, setWhatsAppUnreadCount] = useState(0)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const hasLoggedError = useRef(false)

  const isEmployee = userRole === "technician"

  // Fetch notifications + whatsapp + assigned jobs
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const fetches: Promise<Response>[] = [
          fetch("/api/notifications?limit=25", { cache: "no-store" }),
          fetch("/api/admin/messages", { cache: "no-store" }),
        ]
        if (isEmployee) fetches.push(fetch("/api/jobs/assigned", { cache: "no-store" }))

        const [nr, wr, jr] = await Promise.all(fetches)

        if (!nr.ok) return
        const data = await nr.json()
        const rows: HeaderNotification[] = Array.isArray(data.notifications) ? data.notifications : []

        if (wr.ok) {
          const wd = (await wr.json()) as WhatsAppMessagesResponse
          const wRows = Array.isArray(wd.messages) ? wd.messages : []
          const unreadPhones = new Set(
            wRows
              .filter((m) => isUnreadWhatsAppStatus(m.status) && m.phoneNumber)
              .map((m) => m.phoneNumber as string)
          )
          if (mounted) setWhatsAppUnreadCount(unreadPhones.size)
        }

        if (mounted) { setNotifications(rows); hasLoggedError.current = false }

        if (jr && jr.ok) {
          const jd = await jr.json()
          if (mounted) setAssignedJobs(Array.isArray(jd.allocations) ? jd.allocations : [])
        }
      } catch (err) {
        if (!hasLoggedError.current) { console.warn("[TOPBAR]", err); hasLoggedError.current = true }
      }
    }
    void load()
    const t = window.setInterval(load, 15000)
    return () => { mounted = false; window.clearInterval(t) }
  }, [isEmployee])

  // Bell click — navigate directly to all-notifications (no dropdown, same for all roles)
  const handleBellClick = useCallback(() => {
    if (onNotificationNavigate) onNotificationNavigate("all-notifications")
  }, [onNotificationNavigate])

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const pendingJobCount = assignedJobs.filter((j) => j.status !== "completed").length
  const bellBadge = unreadCount + (isEmployee ? pendingJobCount : 0)

  return (
    <header className="w-full flex items-center gap-3 h-14 px-4 bg-white border border-slate-100 shrink-0 rounded-2xl">
      {/* Mobile menu toggle */}
      {!isEmployee && (
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-slate-500" />
        </button>
      )}

      {/* Employee DP — shown on the left for employee role */}
      {isEmployee && (
        <EmployeeDpButton
          photoUrl={employeePhotoUrl}
          userName={userName}
          mobile={userMobile}
          onNavigateDashboard={onNavigateDashboard}
          onLogout={onLogout}
        />
      )}

      {/* Page title */}
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

      {/* Search */}
      {searchConfig ? (
        <>
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
          <div className="hidden sm:flex items-center gap-2 shrink-0">{customSearch}</div>
        </>
      ) : null}

      {/* Action icons */}
      <div className={`flex items-center gap-0.5 ${mobileSearchOpen ? "hidden sm:flex" : ""}`}>

        {/* Attendance icon (employee) */}
        {isEmployee && onAttendance && (
          <button
            onClick={onAttendance}
            className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
            title="My Attendance"
            aria-label="My Attendance"
          >
            <CalendarCheck className="w-5 h-5" />
          </button>
        )}

        {/* WhatsApp — always visible for allowed roles */}
        {whatsAppAllowed && !isEmployee && (
          <button
            onClick={onWhatsApp}
            className="relative p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
            title="WhatsApp Messages"
            aria-label="WhatsApp Messages"
          >
            <WhatsAppIcon className="w-5 h-5" />
            {whatsAppUnreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
                {whatsAppUnreadCount > 9 ? "9+" : whatsAppUnreadCount}
              </span>
            )}
          </button>
        )}

        {/* Settings shortcut — admin / non-employee */}
        {settingsAllowed && !isEmployee && onSettings && (
          <button
            onClick={onSettings}
            className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}

        {/* Notifications bell — click navigates directly */}
        <button
          onClick={handleBellClick}
          className="relative p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
          title={isEmployee ? "My Assigned Jobs" : "Notifications"}
          aria-label={isEmployee ? "My Assigned Jobs" : "Notifications"}
        >
          <Bell className="w-5 h-5" />
          {bellBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
              {bellBadge > 9 ? "9+" : bellBadge}
            </span>
          )}
        </button>

        {/* User info (non-employee) */}
        {!isEmployee && (
          <div className="flex items-center gap-2 ml-1 pl-2 border-l border-slate-100">
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <UserCircle className="w-5 h-5 text-slate-400" />
            </div>
            <div className="hidden md:flex md:flex-col leading-tight">
              <span className="text-sm font-semibold text-slate-700">{userName || "User"}</span>
              <span className="text-xs text-slate-400 capitalize">{userRole || ""}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/notify"
import { formatDateDDMMYY } from "@/lib/utils"
import { AddCustomerModal } from "@/components/dashboard/add-customer-modal"
import { AddVehicleModal } from "@/components/dashboard/add-vehicle-modal"
import {
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle2,
  Truck,
  ArrowRightLeft,
  XCircle,
  ChevronRight,
  Wrench,
  Zap,
  Wind,
  HelpCircle,
  RefreshCw,
  MapPin,
  User,
  Car,
  Calendar,
  Undo2,
  ArrowLeft,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type BreakdownStatus =
  | "Pending"
  | "Notified"
  | "Accepted"
  | "PickedUp"
  | "ReachedGarage"
  | "Transferred"
  | "Cancelled"

type BreakdownType = "Mechanical" | "Electrical" | "AC" | "Other"

interface Customer {
  id: string
  name: string
  mobileNo: string
}

interface Vehicle {
  id: string
  registrationNumber: string
  make: string
  model: string
  year?: number | null
}

interface Milestone {
  id: string
  event: string
  actorName?: string | null
  note?: string | null
  createdAt: string
}

interface Breakdown {
  id: string
  breakdownNumber: string
  status: BreakdownStatus
  breakdownType: BreakdownType
  reason: string
  location?: string | null
  kmDriven?: number | null
  customer: Customer
  vehicle: Vehicle
  createdByName?: string | null
  acceptedByUserId?: string | null
  acceptedByName?: string | null
  acceptedAt?: string | null
  reachedGarageAt?: string | null
  reachedGarageByName?: string | null
  transferredAt?: string | null
  transferredByName?: string | null
  jobCard?: { id: string; jobCardNumber: string } | null
  milestones?: Milestone[]
  createdAt: string
}

/**
 * Departments eligible for each breakdown type.
 * Must stay in sync with the server-side BREAKDOWN_ELIGIBLE_DEPARTMENTS map in
 * app/api/breakdowns/[id]/route.ts — the backend is the source of truth; this
 * is used only for UI hints/disabling (the server will reject ineligible calls).
 */
const BREAKDOWN_ELIGIBLE_DEPARTMENTS: Record<BreakdownType, string[]> = {
  Mechanical: ["Mechanical"],
  Electrical: ["Electrical"],
  AC: ["AC / Air Conditioning"],
  // "Other" → any of the three technical departments
  Other: ["Mechanical", "Electrical", "AC / Air Conditioning"],
}

interface BreakdownFormData {
  mobileNo: string
  customerId: string
  customerName: string
  registrationNumber: string
  vehicleId: string
  vehicleMake: string
  vehicleModel: string
  breakdownType: BreakdownType | ""
  reason: string
  location: string
  kmDriven: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BreakdownStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  Pending:       { label: "Pending",        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",   icon: Clock },
  Notified:      { label: "Notified",       color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",     icon: AlertTriangle },
  Accepted:      { label: "Accepted",       color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", icon: CheckCircle2 },
  PickedUp:      { label: "Picked Up",      color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: Truck },
  ReachedGarage: { label: "At Garage",      color: "text-green-700",  bg: "bg-green-50 border-green-200",   icon: Truck },
  Transferred:   { label: "Transferred",    color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: ArrowRightLeft },
  Cancelled:     { label: "Cancelled",      color: "text-slate-500",  bg: "bg-slate-50 border-slate-200",   icon: XCircle },
}

const TYPE_ICON: Record<BreakdownType, React.ElementType> = {
  Mechanical: Wrench,
  Electrical: Zap,
  AC:         Wind,
  Other:      HelpCircle,
}

const TYPE_COLOR: Record<BreakdownType, string> = {
  Mechanical: "text-orange-600",
  Electrical: "text-yellow-600",
  AC:         "text-cyan-600",
  Other:      "text-slate-500",
}

const ALL_STATUSES: BreakdownStatus[] = [
  "Pending", "Notified", "Accepted", "PickedUp", "ReachedGarage", "Transferred", "Cancelled",
]

function StatusBadge({ status }: { status: BreakdownStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function TypeBadge({ type }: { type: BreakdownType }) {
  const Icon = TYPE_ICON[type] || HelpCircle
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${TYPE_COLOR[type] || "text-slate-500"}`}>
      <Icon className="w-3.5 h-3.5" />
      {type}
    </span>
  )
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "-"
  const d = new Date(iso)
  return `${d.toLocaleDateString("en-IN")} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
}

function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  const EVENT_ICON: Record<string, React.ElementType> = {
    Created:           Plus,
    NotificationsSent: AlertTriangle,
    Accepted:          CheckCircle2,
    ReverseAccepted:   Undo2,
    PickedUp:          Truck,
    ReachedGarage:     Truck,
    Transferred:       ArrowRightLeft,
    Cancelled:         XCircle,
  }
  const EVENT_COLOR: Record<string, string> = {
    Created:           "bg-slate-500",
    NotificationsSent: "bg-blue-500",
    Accepted:          "bg-indigo-500",
    ReverseAccepted:   "bg-amber-500",
    PickedUp:          "bg-orange-500",
    ReachedGarage:     "bg-green-500",
    Transferred:       "bg-purple-500",
    Cancelled:         "bg-red-400",
  }
  const EVENT_LABEL: Record<string, string> = {
    Created:           "Created",
    NotificationsSent: "Notifications Sent",
    Accepted:          "Accepted",
    ReverseAccepted:   "Acceptance Reversed",
    PickedUp:          "Vehicle Picked Up",
    ReachedGarage:     "Dropped at Garage",
    Transferred:       "Transferred to Jobcard",
    Cancelled:         "Cancelled",
  }

  return (
    <div className="space-y-0">
      {milestones.map((m, idx) => {
        const Icon = EVENT_ICON[m.event] || Clock
        const dotColor = EVENT_COLOR[m.event] || "bg-slate-400"
        const isLast = idx === milestones.length - 1
        return (
          <div key={m.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${dotColor}`}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-0.5" />}
            </div>
            <div className={`pb-4 ${isLast ? "" : ""}`}>
              <p className="text-sm font-medium text-slate-800">{EVENT_LABEL[m.event] || m.event}</p>
              {m.actorName && <p className="text-xs text-slate-500">by {m.actorName}</p>}
              {m.note && <p className="text-xs text-slate-400 mt-0.5">{m.note}</p>}
              <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(m.createdAt)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Breakdown Tech Panel (for notification inline view) ─────────────────────

export function BreakdownTechPanel({
  breakdownId,
  userId,
  userDepartment,
}: {
  breakdownId: string
  /** AppUser.id of the currently logged-in user (used for ownership checks). */
  userId?: string
  /** Employee department string (e.g. "Mechanical") used to gate the Accept button. */
  userDepartment?: string | null
}) {
  const [bd, setBd] = useState<Breakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/breakdowns/${breakdownId}`)
      const data = await res.json()
      if (res.ok) setBd(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [breakdownId])

  useEffect(() => { void load() }, [load])

  const performAction = async (action: string) => {
    setActionLoading(true)
    setActionError("")
    try {
      const res = await fetch(`/api/breakdowns/${breakdownId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) {
        setBd(data)
      } else {
        setActionError(data.error || "Action failed")
      }
    } catch { setActionError("Action failed") } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground text-center">Loading breakdown…</div>
  if (!bd) return <div className="p-6 text-sm text-muted-foreground text-center">Breakdown not found.</div>

  const done = ["ReachedGarage", "Transferred", "Cancelled"].includes(bd.status)

  // Eligibility: can this user accept?
  const eligibleDepts = BREAKDOWN_ELIGIBLE_DEPARTMENTS[bd.breakdownType] ?? []
  const canAccept = userDepartment ? eligibleDepts.includes(userDepartment) : true // show if unknown (server enforces)
  const isAcceptingTech = userId ? bd.acceptedByUserId === userId : true // assume owner if userId unknown

  return (
    <div className="p-5 space-y-5 overflow-y-auto thin-scrollbar h-full">
      {/* Vehicle & job info */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              {bd.vehicle.make} {bd.vehicle.model} — {bd.vehicle.registrationNumber}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{bd.customer.name} • {bd.customer.mobileNo}</p>
          </div>
          <StatusBadge status={bd.status} />
        </div>
        {bd.location && (
          <p className="text-xs text-slate-600 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
            {bd.location}
          </p>
        )}
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Reason</p>
          <p className="text-sm text-slate-700">{bd.reason}</p>
        </div>
      </div>

      {/* Error feedback */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Stepper */}
      {!done && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Your Actions</p>
          <TechnicianStepper
            status={bd.status}
            actionLoading={actionLoading}
            canAccept={canAccept}
            canPickupDrop={isAcceptingTech}
            onAccept={() => performAction("accept")}
            onPickup={() => performAction("pickup")}
            onDrop={() => performAction("reached_garage")}
          />
          {/* Reverse Accept — shown to the accepting technician while still in Accepted state */}
          {bd.status === "Accepted" && isAcceptingTech && userId && (
            <div className="mt-4">
              <Button
                size="sm"
                variant="outline"
                className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-1.5 w-full"
                disabled={actionLoading}
                onClick={() => {
                  if (confirm("Reverse your acceptance? The breakdown will be re-opened for others.")) {
                    void performAction("unaccept")
                  }
                }}
              >
                <Undo2 className="w-3.5 h-3.5" />
                Reverse Acceptance
              </Button>
            </div>
          )}
        </div>
      )}

      {bd.status === "ReachedGarage" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-7 h-7 text-green-500 mx-auto mb-1" />
          <p className="text-sm font-medium text-green-800">Vehicle dropped at garage</p>
          <p className="text-xs text-green-600 mt-0.5">Admin will transfer it to a jobcard</p>
        </div>
      )}

      {bd.status === "Transferred" && bd.jobCard && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <ArrowRightLeft className="w-7 h-7 text-purple-500 mx-auto mb-1" />
          <p className="text-sm font-medium text-purple-800">Transferred to {bd.jobCard.jobCardNumber}</p>
        </div>
      )}

      {bd.status === "Cancelled" && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <XCircle className="w-7 h-7 text-slate-400 mx-auto mb-1" />
          <p className="text-sm font-medium text-slate-600">This breakdown was cancelled</p>
        </div>
      )}

      {/* Timeline */}
      {bd.milestones && bd.milestones.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Timeline</p>
          <MilestoneTimeline milestones={bd.milestones} />
        </div>
      )}
    </div>
  )
}

// ─── Main Module ──────────────────────────────────────────────────────────────

interface BreakdownModuleProps {
  userRole?: string
  userId?: string
  userName?: string
  /** Employee department (e.g. "Mechanical") — used to gate Accept for technicians. */
  userDepartment?: string | null
  /** Employee designation — used as legacy fallback when department is null. */
  userDesignation?: string | null
  initialBreakdownId?: string
  /** Search value controlled externally (e.g. from the TopBar). */
  externalSearch?: string
}

export function BreakdownModule({
  userRole = "admin",
  userId,
  userName,
  userDepartment,
  userDesignation,
  initialBreakdownId,
  externalSearch,
}: BreakdownModuleProps) {
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([])
  const [loading, setLoading] = useState(false)
  const search = externalSearch ?? ""
  const [statusFilter, setStatusFilter] = useState<string>("active")
  const [selectedBreakdown, setSelectedBreakdown] = useState<Breakdown | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [transferMaintenanceType, setTransferMaintenanceType] = useState("")
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")
  const initialLoadedRef = useRef<string>("")

  const isTech = userRole === "technician"
  const isAdmin = userRole === "admin" || userRole === "manager"

  /**
   * Returns true when the current technician's department (or designation as
   * legacy fallback) is eligible to accept the given breakdownType.
   * The backend is the authoritative check; this is UI-only gating.
   */
  const isTechEligibleForType = (breakdownType: BreakdownType): boolean => {
    if (!isTech) return false
    const eligibleDepts = BREAKDOWN_ELIGIBLE_DEPARTMENTS[breakdownType] ?? []
    if (userDepartment) return eligibleDepts.includes(userDepartment)
    // Legacy fallback — no department set
    if (!userDesignation) return true // unknown, show the button (server will reject if ineligible)
    const legacyDesignations: Record<BreakdownType, string[]> = {
      Mechanical: ["Mechanic", "Senior Mechanic", "Foreman", "Workshop Supervisor", "Helper", "Trainee"],
      Electrical: ["Auto Electrician", "Senior Electrician", "Electrical Helper", "Electrician"],
      AC: ["AC Technician", "Senior AC Technician", "AC Helper"],
      Other: [
        "Mechanic", "Senior Mechanic", "Foreman", "Workshop Supervisor",
        "Auto Electrician", "Senior Electrician", "Electrician",
        "AC Technician", "Senior AC Technician",
      ],
    }
    return (legacyDesignations[breakdownType] ?? []).includes(userDesignation)
  }

  const fetchBreakdowns = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("q", search)
      // active = anything not terminal
      const res = await fetch(`/api/breakdowns?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      let list: Breakdown[] = Array.isArray(data) ? data : []
      if (statusFilter === "active") {
        list = list.filter((b) => !["Transferred", "Cancelled"].includes(b.status))
      } else if (statusFilter !== "all") {
        list = list.filter((b) => b.status === statusFilter)
      }
      setBreakdowns(list)
    } catch (e: any) {
      toast.error(e.message || "Failed to load breakdowns")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { void fetchBreakdowns() }, [fetchBreakdowns])

  // Auto-open a specific breakdown (e.g. from notification link)
  useEffect(() => {
    if (!initialBreakdownId || initialBreakdownId === initialLoadedRef.current) return
    initialLoadedRef.current = initialBreakdownId
    void loadDetail(initialBreakdownId)
    // Switch filter to "all" so the breakdown appears in the list
    setStatusFilter("all")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBreakdownId])

  const loadDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/breakdowns/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSelectedBreakdown(data)
    } catch (e: any) {
      toast.error(e.message || "Failed to load breakdown")
    } finally {
      setDetailLoading(false)
    }
  }

  const performAction = async (action: string, extra?: Record<string, string>) => {
    if (!selectedBreakdown) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/breakdowns/${selectedBreakdown.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")
      setSelectedBreakdown(data)
      void fetchBreakdowns()
      if (action === "transfer") {
        toast.success(`Jobcard ${data.newJobCard?.jobCardNumber} created!`)
        setShowTransferDialog(false)
      }
    } catch (e: any) {
      toast.error(e.message || "Action failed")
    } finally {
      setActionLoading(false)
    }
  }

  const bd = selectedBreakdown

  return (
    <div className="grid min-h-0 flex-1 h-full items-stretch xl:gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
      {/* ── Left Panel: List ── */}
      <div className={`flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden
        ${mobileView === "list" ? "flex" : "hidden"} xl:flex`}>
        {/* Header */}
        <div className="px-4 pt-3 pb-3 border-b border-slate-100 shrink-0">
          {/* Title row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-semibold text-slate-800">Breakdowns</h2>
              <span className="text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded-full">
                {breakdowns.length}
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={fetchBreakdowns}
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              </Button>
              {!isTech && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 bg-transparent hover:bg-[#4361ee] text-[#4361ee] hover:text-white px-2"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </Button>
              )}
            </div>
          </div>

          {/* Status filter — dropdown */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v)}
          >
            <SelectTrigger className="h-9 text-sm rounded-xl bg-slate-50 border-slate-200">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto thin-scrollbar">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : breakdowns.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No breakdowns found</div>
          ) : (
            breakdowns.map((b) => {
              const TypeIcon = TYPE_ICON[b.breakdownType] || HelpCircle
              const isActive = selectedBreakdown?.id === b.id
              return (
                <button
                  key={b.id}
                  onClick={() => { void loadDetail(b.id); setMobileView("detail") }}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors hover:bg-slate-50 ${
                    isActive ? "bg-[#eef2ff]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <TypeIcon className={`w-3.5 h-3.5 shrink-0 ${TYPE_COLOR[b.breakdownType]}`} />
                        <span className="text-xs font-mono text-slate-500">{b.breakdownNumber}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {b.vehicle.registrationNumber}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{b.customer.name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={b.status} />
                      <span className="text-[10px] text-slate-400">
                        {formatDateDDMMYY(b.createdAt)}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right Panel: Detail ── */}
      <div className={`min-w-0 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col
        ${mobileView === "detail" ? "flex" : "hidden"} xl:flex`}>
        {detailLoading ? (
          <>
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="xl:hidden flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#4361ee] hover:text-[#3451d1] border-b border-slate-100"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to breakdowns
            </button>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          </>
        ) : !bd ? (
          <>
            {/* Mobile back button — shown even when no item selected */}
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="xl:hidden flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#4361ee] hover:text-[#3451d1] border-b border-slate-100"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to breakdowns
            </button>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm text-muted-foreground">Select a breakdown to view details</p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Detail header */}
            <div className="px-6 py-4 border-b border-slate-100 shrink-0">
              {/* Mobile back button */}
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="xl:hidden flex items-center gap-1.5 mb-3 text-sm font-medium text-[#4361ee] hover:text-[#3451d1]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to breakdowns
              </button>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TypeBadge type={bd.breakdownType} />
                    <span className="text-xs text-slate-400 font-mono">{bd.breakdownNumber}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    {bd.vehicle.registrationNumber}
                  </h2>
                  <p className="text-sm text-slate-500">{bd.customer.name} • {bd.customer.mobileNo}</p>
                </div>
                <StatusBadge status={bd.status} />
              </div>
            </div>

            {/* Detail body */}
            <div className="flex-1 overflow-y-auto thin-scrollbar">
              {isTech ? (
                /* ── Technician View: Stepper + info ── */
                <div className="p-5 space-y-6">
                  {/* Breakdown brief */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{bd.vehicle.make} {bd.vehicle.model} — {bd.vehicle.registrationNumber}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{bd.customer.name} • {bd.customer.mobileNo}</p>
                      </div>
                    </div>
                    {bd.location && (
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        {bd.location}
                      </p>
                    )}
                    <div className="mt-1">
                      <p className="text-xs text-slate-400 mb-1">Reason</p>
                      <p className="text-sm text-slate-700">{bd.reason}</p>
                    </div>
                  </div>

                  {/* Stepper */}
                  {bd.status !== "Transferred" && bd.status !== "Cancelled" && (() => {
                    const isAcceptingTech = userId ? bd.acceptedByUserId === userId : true
                    const canAccept = isTechEligibleForType(bd.breakdownType)
                    return (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Your Actions</h3>
                        <TechnicianStepper
                          status={bd.status}
                          actionLoading={actionLoading}
                          canAccept={canAccept}
                          canPickupDrop={isAcceptingTech}
                          onAccept={() => performAction("accept")}
                          onPickup={() => performAction("pickup")}
                          onDrop={() => performAction("reached_garage")}
                        />
                        {/* Reverse Accept — shown to the technician who accepted, while still in Accepted state */}
                        {bd.status === "Accepted" && isAcceptingTech && userId && (
                          <div className="mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-1.5 w-full"
                              disabled={actionLoading}
                              onClick={() => {
                                if (confirm("Reverse your acceptance? The breakdown will be re-opened for others.")) {
                                  void performAction("unaccept")
                                }
                              }}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              Reverse Acceptance
                            </Button>
                          </div>
                        )}
                        {/* Ineligible department notice */}
                        {bd.status !== "Accepted" && !canAccept && (
                          <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Your department is not assigned to {bd.breakdownType} breakdowns.
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  {bd.status === "ReachedGarage" && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <CheckCircle2 className="w-7 h-7 text-green-500 mx-auto mb-1" />
                      <p className="text-sm font-medium text-green-800">Vehicle dropped at garage</p>
                      <p className="text-xs text-green-600 mt-0.5">Admin will transfer it to a jobcard</p>
                    </div>
                  )}

                  {bd.status === "Transferred" && bd.jobCard && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                      <ArrowRightLeft className="w-7 h-7 text-purple-500 mx-auto mb-1" />
                      <p className="text-sm font-medium text-purple-800">Transferred to {bd.jobCard.jobCardNumber}</p>
                    </div>
                  )}

                  {bd.status === "Cancelled" && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <XCircle className="w-7 h-7 text-slate-400 mx-auto mb-1" />
                      <p className="text-sm font-medium text-slate-600">This breakdown was cancelled</p>
                    </div>
                  )}

                  {/* Timeline */}
                  {bd.milestones && bd.milestones.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Timeline</h3>
                      <MilestoneTimeline milestones={bd.milestones} />
                    </div>
                  )}
                </div>
              ) : (
                /* ── Admin / Manager View ── */
                <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  {/* Left: info */}
                  <div className="p-6 space-y-5">
                    {/* Vehicle */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5" /> Vehicle
                      </h3>
                      <div className="space-y-1">
                        <InfoRow label="Registration" value={bd.vehicle.registrationNumber} />
                        <InfoRow label="Make / Model" value={`${bd.vehicle.make} ${bd.vehicle.model}`} />
                        {bd.vehicle.year && <InfoRow label="Year" value={String(bd.vehicle.year)} />}
                        {bd.kmDriven && <InfoRow label="KM at breakdown" value={String(bd.kmDriven)} />}
                      </div>
                    </div>

                    {/* Breakdown info */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Breakdown Details
                      </h3>
                      <div className="space-y-1">
                        <InfoRow label="Type" value={bd.breakdownType} />
                        {bd.location && <InfoRow label="Location" value={bd.location} icon={MapPin} />}
                        <div className="mt-1">
                          <p className="text-xs text-slate-400 mb-0.5">Reason</p>
                          <p className="text-sm text-slate-700 bg-slate-50 rounded-md p-2">{bd.reason}</p>
                        </div>
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Activity
                      </h3>
                      <div className="space-y-1">
                        {bd.createdByName && <InfoRow label="Created by" value={bd.createdByName} icon={User} />}
                        <InfoRow label="Created at" value={fmtDateTime(bd.createdAt)} />
                        {bd.acceptedByName && (
                          <InfoRow label="Accepted by" value={`${bd.acceptedByName} at ${fmtDateTime(bd.acceptedAt)}`} />
                        )}
                        {bd.reachedGarageAt && (
                          <InfoRow label="Dropped at garage" value={fmtDateTime(bd.reachedGarageAt)} />
                        )}
                        {bd.transferredAt && (
                          <InfoRow label="Transferred" value={fmtDateTime(bd.transferredAt)} />
                        )}
                        {bd.jobCard && (
                          <InfoRow label="Jobcard" value={bd.jobCard.jobCardNumber} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: timeline + admin actions */}
                  <div className="p-6 space-y-5">
                    {/* Admin actions */}
                    {bd.status !== "Transferred" && bd.status !== "Cancelled" && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Actions</h3>
                        <div className="flex flex-wrap gap-2">
                          {/* Transfer to jobcard — when at garage (or accepted) */}
                          {isAdmin && ["Accepted", "PickedUp", "ReachedGarage"].includes(bd.status) && (
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                              disabled={actionLoading}
                              onClick={() => setShowTransferDialog(true)}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              Transfer to Jobcard
                            </Button>
                          )}

                          {/* Admin reverse accept — only while still Accepted (not yet picked up) */}
                          {isAdmin && bd.status === "Accepted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-1.5"
                              disabled={actionLoading}
                              title="Reverse the technician's acceptance so this breakdown is open again"
                              onClick={() => {
                                if (confirm("Reverse acceptance? The breakdown will be re-opened for re-assignment.")) {
                                  void performAction("unaccept")
                                }
                              }}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              Reverse Accept
                            </Button>
                          )}

                          {/* Cancel — admin only */}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 border-red-200 hover:bg-red-50 gap-1.5"
                              disabled={actionLoading}
                              onClick={() => {
                                if (confirm("Cancel this breakdown?")) performAction("cancel")
                              }}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Milestone timeline */}
                    {bd.milestones && bd.milestones.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Timeline</h3>
                        <MilestoneTimeline milestones={bd.milestones} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Create Form Dialog ── */}
      {showCreateForm && (
        <CreateBreakdownDialog
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false)
            void fetchBreakdowns()
          }}
        />
      )}

      {/* ── Transfer to Jobcard Dialog ── */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-sm overflow-hidden rounded-2xl">
          <DialogHeader>
            <DialogTitle>Transfer to Jobcard</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              A new jobcard will be created from this breakdown. You can update it further after transfer.
            </p>
            <div className="space-y-2">
              <Label>Maintenance Type (optional)</Label>
              <Input
                placeholder={bd?.breakdownType || "e.g. Oil Change"}
                value={transferMaintenanceType}
                onChange={(e) => setTransferMaintenanceType(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancel</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={actionLoading}
              onClick={() => performAction("transfer", { maintenanceType: transferMaintenanceType })}
            >
              {actionLoading ? "Creating…" : "Create Jobcard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Technician Stepper ───────────────────────────────────────────────────────

const TECH_STEPS = [
  { key: "accept",  label: "Accept",       sublabel: "Take the job",          icon: CheckCircle2, activeStatuses: ["Pending", "Notified"] as string[] },
  { key: "pickup",  label: "Pick Up",      sublabel: "Vehicle picked up",     icon: Truck,        activeStatuses: ["Accepted"] as string[] },
  { key: "drop",    label: "Drop at Garage", sublabel: "Vehicle at garage",   icon: Truck,        activeStatuses: ["PickedUp"] as string[] },
]

const STATUS_STEP_INDEX: Record<string, number> = {
  Pending: 0, Notified: 0,
  Accepted: 1,
  PickedUp: 2,
  ReachedGarage: 3,
  Transferred: 3,
  Cancelled: -1,
}

function TechnicianStepper({
  status,
  actionLoading,
  canAccept = true,
  canPickupDrop = true,
  onAccept,
  onPickup,
  onDrop,
}: {
  status: string
  actionLoading: boolean
  /**
   * True when the current user's department matches the breakdown type.
   * When false the Accept button is hidden and an ineligible notice shown.
   */
  canAccept?: boolean
  /**
   * True when the current user is the technician who accepted this breakdown.
   * When false Pickup/Drop buttons are hidden.
   */
  canPickupDrop?: boolean
  onAccept: () => void
  onPickup: () => void
  onDrop: () => void
}) {
  const currentStep = STATUS_STEP_INDEX[status] ?? 0
  const actions = [onAccept, onPickup, onDrop]
  // Whether the button for each step index is permitted
  const permitted = [canAccept, canPickupDrop, canPickupDrop]

  return (
    <div className="space-y-3">
      {TECH_STEPS.map((step, idx) => {
        const done = currentStep > idx
        const active = currentStep === idx
        const allowed = permitted[idx]
        const Icon = step.icon
        return (
          <div
            key={step.key}
            className={`relative rounded-xl border p-4 flex items-center gap-4 transition-all ${
              done
                ? "bg-green-50 border-green-200"
                : active
                ? "bg-[#eef2ff] border-[#4361ee] shadow-sm"
                : "bg-slate-50 border-slate-100 opacity-50"
            }`}
          >
            {/* Step indicator */}
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                done ? "bg-green-500" : active ? "bg-[#4361ee]" : "bg-slate-300"
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <Icon className="w-5 h-5 text-white" />
              )}
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${done ? "text-green-800" : active ? "text-[#4361ee]" : "text-slate-500"}`}>
                {step.label}
              </p>
              <p className={`text-xs ${done ? "text-green-600" : active ? "text-slate-500" : "text-slate-400"}`}>
                {done
                  ? "Done"
                  : active && !allowed
                  ? idx === 0
                    ? "Not eligible for this breakdown type"
                    : "Not assigned to you"
                  : step.sublabel}
              </p>
            </div>

            {/* Action button — only shown when this step is active AND the user is permitted */}
            {active && allowed && (
              <Button
                size="sm"
                className="shrink-0 bg-[#4361ee] hover:bg-[#3451d1] text-white gap-1.5"
                disabled={actionLoading}
                onClick={actions[idx]}
              >
                {actionLoading ? "…" : step.label}
              </Button>
            )}

            {/* Connector line */}
            {idx < TECH_STEPS.length - 1 && (
              <div className="absolute left-[2.05rem] -bottom-3 w-0.5 h-3 bg-slate-200" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Info Row helper ──────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ElementType
}) {
  return (
    <div className="flex gap-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />}
      <div className={Icon ? "" : "flex gap-2"}>
        <span className={`text-xs text-slate-400 ${Icon ? "block" : "shrink-0"}`}>{label}:</span>
        <span className="text-sm text-slate-700">{value}</span>
      </div>
    </div>
  )
}

// ─── Create Breakdown Dialog ──────────────────────────────────────────────────

function CreateBreakdownDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<BreakdownFormData>({
    mobileNo: "",
    customerId: "",
    customerName: "",
    registrationNumber: "",
    vehicleId: "",
    vehicleMake: "",
    vehicleModel: "",
    breakdownType: "",
    reason: "",
    location: "",
    kmDriven: "",
  })
  const [saving, setSaving] = useState(false)
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [customerDropOpen, setCustomerDropOpen] = useState(false)
  const [vehicleResults, setVehicleResults] = useState<Vehicle[]>([])
  const [vehicleDropOpen, setVehicleDropOpen] = useState(false)
  const [customerNotFoundAlert, setCustomerNotFoundAlert] = useState(false)
  const [vehicleNotFoundAlert, setVehicleNotFoundAlert] = useState(false)
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false)
  const [addVehicleModalOpen, setAddVehicleModalOpen] = useState(false)
  const mobileDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vehicleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCustomerVehicles = async (customerId: string) => {
    try {
      const res = await fetch(`/api/vehicles?customerId=${encodeURIComponent(customerId)}`)
      const data = await res.json()
      const list: Vehicle[] = Array.isArray(data) ? data : []
      setVehicleResults(list)
      setVehicleDropOpen(list.length > 0)
    } catch { /* ignore */ }
  }

  const searchCustomer = async (mobile: string) => {
    if (mobile.length < 3) { setCustomerResults([]); setCustomerDropOpen(false); return }
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(mobile)}`)
      const data = await res.json()
      const list: Customer[] = Array.isArray(data) ? data : []
      setCustomerResults(list)
      setCustomerDropOpen(list.length > 0)
    } catch { /* ignore */ }
  }

  const searchVehicle = async (reg: string) => {
    if (reg.length < 2) {
      if (form.customerId) { fetchCustomerVehicles(form.customerId); return }
      setVehicleResults([]); setVehicleDropOpen(false); return
    }
    try {
      const url = `/api/vehicles?registration=${encodeURIComponent(reg)}`
      const res = await fetch(url)
      const data = await res.json()
      const list: Vehicle[] = Array.isArray(data) ? data : []
      setVehicleResults(list)
      setVehicleDropOpen(list.length > 0)
    } catch { /* ignore */ }
  }

  const handleMobileChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10)
    setForm((p) => ({ ...p, mobileNo: digits, customerId: "", customerName: "" }))
    setCustomerDropOpen(false)
    setCustomerResults([])
    if (mobileDebounce.current) clearTimeout(mobileDebounce.current)
    mobileDebounce.current = setTimeout(() => searchCustomer(digits), 300)
  }

  const handleMobileBlur = async () => {
    const mobile = form.mobileNo.trim()
    if (!mobile || form.customerId || mobile.length < 10) return
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(mobile)}`)
      const data = await res.json()
      const list: Customer[] = Array.isArray(data) ? data : []
      const exact = list.find((c) => c.mobileNo === mobile)
      if (exact) {
        selectCustomer(exact)
      } else if (list.length === 0) {
        setCustomerNotFoundAlert(true)
      }
    } catch { /* ignore */ }
  }

  const selectCustomer = (c: Customer) => {
    setForm((p) => ({ ...p, customerId: c.id, customerName: c.name, mobileNo: c.mobileNo }))
    setCustomerDropOpen(false)
    setVehicleResults([])
    fetchCustomerVehicles(c.id)
  }

  const handleRegChange = (value: string) => {
    const upper = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    setForm((p) => ({ ...p, registrationNumber: upper, vehicleId: "", vehicleMake: "", vehicleModel: "" }))
    setVehicleDropOpen(false)
    if (vehicleDebounce.current) clearTimeout(vehicleDebounce.current)
    vehicleDebounce.current = setTimeout(() => searchVehicle(upper), 300)
  }

  const handleRegBlur = async () => {
    const reg = form.registrationNumber.trim()
    if (!reg || form.vehicleId || reg.length < 4) return
    try {
      const url = `/api/vehicles?registration=${encodeURIComponent(reg)}`
      const res = await fetch(url)
      const data = await res.json()
      const list: Vehicle[] = Array.isArray(data) ? data : []
      if (list.length === 0) {
        setVehicleNotFoundAlert(true)
      } else {
        setVehicleResults(list)
        setVehicleDropOpen(true)
      }
    } catch { /* ignore */ }
  }

  const selectVehicle = (v: Vehicle) => {
    setForm((p) => ({
      ...p,
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      vehicleMake: v.make,
      vehicleModel: v.model,
    }))
    setVehicleDropOpen(false)
    setVehicleResults([])
  }

  const handleSubmit = async () => {
    if (form.mobileNo.length !== 10) return toast.error("Mobile number must be 10 digits")
    if (!form.customerId) return toast.error("Select a customer")
    if (!form.vehicleId) return toast.error("Select a vehicle")
    if (!form.breakdownType) return toast.error("Select breakdown type")
    if (!form.reason.trim()) return toast.error("Reason is required")
    if (!form.location.trim()) return toast.error("Location is required")

    setSaving(true)
    try {
      const res = await fetch("/api/breakdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          vehicleId: form.vehicleId,
          breakdownType: form.breakdownType,
          reason: form.reason.trim(),
          location: form.location.trim(),
          kmDriven: form.kmDriven ? parseInt(form.kmDriven) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create breakdown")
      toast.success(`Breakdown ${data.breakdownNumber} created`)
      onCreated()
    } catch (e: any) {
      toast.error(e.message || "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg overflow-hidden rounded-2xl p-0">
          <div className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Report Breakdown
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto thin-scrollbar px-6 py-4 space-y-4">

            {/* Vehicle Registration */}
            <div className="space-y-2">
              <Label>Vehicle Registration <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  placeholder="e.g. KL35K4578"
                  value={form.registrationNumber}
                  onChange={(e) => handleRegChange(e.target.value)}
                  onFocus={() => {
                    if (form.customerId && vehicleResults.length === 0) fetchCustomerVehicles(form.customerId)
                  }}
                  onBlur={handleRegBlur}
                />
                {vehicleDropOpen && vehicleResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {vehicleResults.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => selectVehicle(v)}
                      >
                        <span className="font-medium">{v.registrationNumber}</span>
                        <span className="text-slate-400 ml-2">{v.make} {v.model}</span>
                      </button>
                    ))}
                    {form.customerId && (
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm text-blue-600 font-medium border-t border-slate-100"
                        onClick={() => { setVehicleDropOpen(false); setAddVehicleModalOpen(true) }}
                      >
                        + Add New Vehicle
                      </button>
                    )}
                  </div>
                )}
              </div>
              {form.vehicleId && (
                <p className="text-xs text-green-600 font-medium">
                  ✓ {form.vehicleMake} {form.vehicleModel}
                </p>
              )}
            </div>

            {/* Customer Mobile */}
            <div className="space-y-2">
              <Label>Customer Mobile <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  placeholder="Enter 10-digit mobile number…"
                  value={form.mobileNo}
                  maxLength={10}
                  inputMode="numeric"
                  onChange={(e) => handleMobileChange(e.target.value)}
                  onBlur={handleMobileBlur}
                />
                {customerDropOpen && customerResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => selectCustomer(c)}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-slate-400 ml-2">{c.mobileNo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.customerName && (
                <p className="text-xs text-green-600 font-medium">✓ {form.customerName}</p>
              )}
            </div>

            {/* Breakdown Type */}
            <div className="space-y-2">
              <Label>Breakdown Type <span className="text-red-500">*</span></Label>
              <Select
                value={form.breakdownType}
                onValueChange={(v) => setForm((p) => ({ ...p, breakdownType: v as BreakdownType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mechanical">Mechanical</SelectItem>
                  <SelectItem value="Electrical">Electrical</SelectItem>
                  <SelectItem value="AC">AC</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason for Breakdown <span className="text-red-500">*</span></Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder="Describe the issue…"
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>

            {/* Location & KM */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Location <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Where is the vehicle?"
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>KM Reading (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 50000"
                  value={form.kmDriven}
                  onChange={(e) => setForm((p) => ({ ...p, kmDriven: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 pb-5 pt-3 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              className="bg-[#4361ee] hover:bg-[#3451d1] text-white gap-1.5"
              disabled={saving}
              onClick={handleSubmit}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {saving ? "Reporting…" : "Report Breakdown"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Customer Not Found alert ── */}
      <AlertDialog open={customerNotFoundAlert} onOpenChange={setCustomerNotFoundAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Customer Not Found</AlertDialogTitle>
            <AlertDialogDescription>
              No customer found for mobile <strong>{form.mobileNo}</strong>. Would you like to create a new customer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setCustomerNotFoundAlert(false); setAddCustomerModalOpen(true) }}
            >
              Create Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Vehicle Not Found alert ── */}
      <AlertDialog open={vehicleNotFoundAlert} onOpenChange={setVehicleNotFoundAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vehicle Not Found</AlertDialogTitle>
            <AlertDialogDescription>
              Vehicle <strong>{form.registrationNumber}</strong> not found.{" "}
              {form.customerId ? "Would you like to add it?" : "Please select a customer first, then add the vehicle."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {form.customerId && (
              <AlertDialogAction
                onClick={() => { setVehicleNotFoundAlert(false); setAddVehicleModalOpen(true) }}
              >
                Add Vehicle
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add Customer Modal ── */}
      <AddCustomerModal
        open={addCustomerModalOpen}
        mobileNumber={form.mobileNo}
        onOpenChange={setAddCustomerModalOpen}
        onCustomerAdded={(customer) => {
          setForm((p) => ({
            ...p,
            customerId: customer.id,
            customerName: customer.name,
            mobileNo: customer.mobileNo,
            registrationNumber: "",
            vehicleId: "",
            vehicleMake: "",
            vehicleModel: "",
          }))
          setAddCustomerModalOpen(false)
          setVehicleResults([])
          fetchCustomerVehicles(customer.id)
        }}
      />

      {/* ── Add Vehicle Modal ── */}
      <AddVehicleModal
        open={addVehicleModalOpen}
        customerId={form.customerId}
        initialRegistration={form.registrationNumber}
        onOpenChange={setAddVehicleModalOpen}
        onVehicleAdded={(vehicle) => {
          setForm((p) => ({
            ...p,
            vehicleId: vehicle.id,
            registrationNumber: vehicle.registrationNumber,
            vehicleMake: vehicle.make,
            vehicleModel: vehicle.model,
          }))
          setAddVehicleModalOpen(false)
          setVehicleDropOpen(false)
        }}
      />
    </>
  )
}

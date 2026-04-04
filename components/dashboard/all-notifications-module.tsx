"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Bell, Trash2, CheckCheck, ExternalLink } from "lucide-react"
import { ApprovalsModule } from "@/components/dashboard/approvals-module"

// ─── Types ────────────────────────────────────────────────────────────────────

type TimelineSectionKey =
  | "created"
  | "assigned"
  | "accepted"
  | "started"
  | "completed"
  | "ready"
  | "delivered"

interface TechnicianTaskRow {
  id: string
  employeeId: number
  technicianName: string
  jobCardId: string
  jobCardNumber: string
  vehicleNumber: string
  vehicleMake?: string
  vehicleModel?: string
  customerName?: string
  serviceDate?: string
  jobCardCreatedAt?: string
  jobCardUpdatedAt?: string
  jobCardStatus: string
  vehicleStatus?: string
  deliveryDate?: string | null
  status: string
  taskAssigned: string
  assignedAt: string
  acceptedAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  turnaroundMinutes: number
}

interface GroupedJobCard {
  jobCardId: string
  jobCardNumber: string
  vehicleNumber: string
  vehicleMake: string
  vehicleModel: string
  customerName: string
  serviceDate?: string
  jobCardCreatedAt?: string
  jobCardUpdatedAt?: string
  jobCardStatus: string
  vehicleStatus: string
  deliveryDate?: string | null
  allocations: TechnicianTaskRow[]
}

interface TimelineItem {
  id: string
  title: string
  caption: string
  time?: string | null
  metadata?: string[]
  status?: string
  action?: "accept" | "start" | "complete" | null
  row?: TechnicianTaskRow
}

interface TimelineSection {
  key: TimelineSectionKey
  title: string
  description: string
  emptyState: string
  items: TimelineItem[]
}

type AppNotification = {
  id: string
  title: string
  body: string
  type: string
  url?: string | null
  targetForm?: string | null
  isRead: boolean
  refType?: string | null
  refId?: string | null
  createdAt: string
}

type LeftItem =
  | { kind: "jobcard"; group: GroupedJobCard; sortMs: number }
  | { kind: "notification"; item: AppNotification; sortMs: number }

interface AllNotificationsModuleProps {
  onNavigate?: (targetForm: string) => void
  currentEmployeeId?: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString()
}

function formatDateCompact(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date)
}

function formatDuration(minutes: number, completedAt?: string | null) {
  const safeMinutes = Math.max(0, Number(minutes) || 0)
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  return completedAt ? duration : `In progress (${duration})`
}

function statusBadgeClass(status: string) {
  if (status === "assigned") return "bg-amber-100 text-amber-800"
  if (status === "accepted") return "bg-blue-100 text-blue-800"
  if (status === "in_progress") return "bg-violet-100 text-violet-800"
  if (status === "completed") return "bg-emerald-100 text-emerald-800"
  if (status === "ready") return "bg-cyan-100 text-cyan-800"
  if (status === "delivered") return "bg-slate-200 text-slate-800"
  return "bg-slate-100 text-slate-700"
}

function formatStatusLabel(status?: string | null) {
  const value = (status || "").trim()
  if (!value) return "Unknown"
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeStatus(value?: string | null) {
  return (value || "").trim().toLowerCase()
}

function getCurrentJobCardStage(group: GroupedJobCard) {
  const vehicleStatus = normalizeStatus(group.vehicleStatus)
  const jobCardStatus = normalizeStatus(group.jobCardStatus)

  if (vehicleStatus === "delivered") return "Delivered"
  if (vehicleStatus === "ready") return "Ready for Delivery"
  if (jobCardStatus === "completed") return "Completed"
  if (group.allocations.some((row) => row.status === "in_progress")) return "In Progress"
  if (group.allocations.some((row) => row.status === "accepted")) return "Accepted"
  if (group.allocations.length > 0) return "Assigned"
  return formatStatusLabel(group.jobCardStatus)
}

function isApprovalNotification(n: AppNotification) {
  return (
    n.type === "approval_request" ||
    n.type === "device_approval_request" ||
    n.url === "/approvals"
  )
}

function formatApprovalDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yy = String(date.getFullYear()).slice(-2)
  const hours = date.getHours()
  const mins = String(date.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "pm" : "am"
  const h = hours % 12 || 12
  return `${dd}/${mm}/${yy} ${h}:${mins} ${ampm}`
}

function parseApprovalInfo(
  n: AppNotification,
  nameMap: Record<string, string>
): { name: string; mobile: string } {
  // "John Doe (9876543210) is waiting for registration approval"
  const regMatch = n.body.match(/^(.+?)\s+\((\d+)\)\s+is waiting/)
  if (regMatch) return { name: regMatch[1], mobile: regMatch[2] }
  // "John Doe requested login from a new device and needs approval."
  const deviceMatch = n.body.match(/^(.+?)\s+requested/)
  if (deviceMatch) return { name: deviceMatch[1], mobile: "-" }
  // fallback: extract bare mobile and look up name from pending users map
  const mobileMatch = n.body.match(/\b(\d{10})\b/)
  const mobile = mobileMatch ? mobileMatch[1] : "-"
  const normKey = mobile !== "-" ? mobile.replace(/\D/g, "").slice(-10) : ""
  const name = normKey ? (nameMap[normKey] ?? "-") : "-"
  return { name, mobile }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AllNotificationsModule({
  onNavigate,
  currentEmployeeId = null,
}: AllNotificationsModuleProps) {
  const canTakeActions = Number.isInteger(currentEmployeeId)

  // Job card state
  const [rows, setRows] = useState<TechnicianTaskRow[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  // Notification state
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notifsLoading, setNotifsLoading] = useState(true)
  const [notifBusy, setNotifBusy] = useState(false)
  const [notifError, setNotifError] = useState<string | null>(null)
  // mobile → name map for approval notifications (left panel display)
  const [approvalNameMap, setApprovalNameMap] = useState<Record<string, string>>({})
  // mobile → userId map for opening the exact approval form
  const [approvalUserIdMap, setApprovalUserIdMap] = useState<Record<string, string>>({})

  // Selection state (unified)
  const [selectedItem, setSelectedItem] = useState<
    | { kind: "jobcard"; jobCardId: string }
    | { kind: "notification"; id: string }
    | null
  >(null)

  // ── Fetch job cards ──────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const fetchRows = async () => {
      setJobsLoading(true)
      try {
        const params = new URLSearchParams()
        if (currentEmployeeId) {
          params.set("employeeId", String(currentEmployeeId))
        }
        const response = await fetch(
          `/api/technician-task-details?${params.toString()}`,
          { cache: "no-store", signal: controller.signal }
        )
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to fetch technician tasks")
        }
        if (isMounted) {
          setRows(Array.isArray(data.allocations) ? data.allocations : [])
        }
      } catch (fetchError: any) {
        if (fetchError?.name === "AbortError") return
        if (isMounted) setRows([])
      } finally {
        if (isMounted) setJobsLoading(false)
      }
    }

    void fetchRows()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [currentEmployeeId, refreshToken])

  // ── Fetch notifications ───────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    setNotifsLoading(true)
    setNotifError(null)
    try {
      const response = await fetch(
        "/api/notifications?includeRead=true&limit=100",
        { cache: "no-store" }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to fetch notifications")
      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : []
      )
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : "Failed to fetch notifications")
      setNotifications([])
    } finally {
      setNotifsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  // ── Fetch pending user names for approval notifications ───────────────────────
  const normMobile = (m?: string | null) => {
    if (!m) return ""
    const digits = String(m).replace(/\D/g, "")
    return digits.length <= 10 ? digits : digits.slice(-10)
  }

  useEffect(() => {
    const hasApproval = notifications.some(isApprovalNotification)
    if (!hasApproval) return
    fetch("/api/auth/pending-users", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const nameMap: Record<string, string> = {}
        const idMap: Record<string, string> = {}
        const all = [
          ...(Array.isArray(data.requests) ? data.requests : []),
          ...(Array.isArray(data.deviceRequests) ? data.deviceRequests : []),
        ]
        all.forEach((u: { id?: string | null; mobile?: string | null; name?: string | null }) => {
          const key = normMobile(u.mobile)
          if (!key) return
          if (u.name) nameMap[key] = String(u.name).trim()
          if (u.id) idMap[key] = String(u.id).trim()
        })
        setApprovalNameMap(nameMap)
        setApprovalUserIdMap(idMap)
      })
      .catch(() => {})
  }, [notifications])

  // ── Group job cards ──────────────────────────────────────────────────────────
  const groupedJobCards = useMemo(() => {
    const groups = new Map<string, GroupedJobCard>()

    rows.forEach((row) => {
      const existing = groups.get(row.jobCardId)
      if (existing) {
        existing.allocations.push(row)
        return
      }
      groups.set(row.jobCardId, {
        jobCardId: row.jobCardId,
        jobCardNumber: row.jobCardNumber,
        vehicleNumber: row.vehicleNumber,
        vehicleMake: row.vehicleMake || "-",
        vehicleModel: row.vehicleModel || "",
        customerName: row.customerName || "-",
        serviceDate: row.serviceDate,
        jobCardCreatedAt: row.jobCardCreatedAt,
        jobCardUpdatedAt: row.jobCardUpdatedAt,
        jobCardStatus: row.jobCardStatus,
        vehicleStatus: row.vehicleStatus || "Pending",
        deliveryDate: row.deliveryDate,
        allocations: [row],
      })
    })

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        allocations: [...group.allocations].sort(
          (a, b) =>
            new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime()
        ),
      }))
      .sort((a, b) => {
        const aTime = new Date(
          a.jobCardUpdatedAt || a.serviceDate || a.jobCardCreatedAt || 0
        ).getTime()
        const bTime = new Date(
          b.jobCardUpdatedAt || b.serviceDate || b.jobCardCreatedAt || 0
        ).getTime()
        return bTime - aTime
      })
  }, [rows])

  // ── Combined left panel items ────────────────────────────────────────────────
  const leftItems = useMemo<LeftItem[]>(() => {
    const jobItems: LeftItem[] = groupedJobCards.map((group) => ({
      kind: "jobcard",
      group,
      sortMs: new Date(
        group.jobCardUpdatedAt || group.serviceDate || group.jobCardCreatedAt || 0
      ).getTime(),
    }))

    const notifItems: LeftItem[] = notifications.map((item) => ({
      kind: "notification",
      item,
      sortMs: new Date(item.createdAt).getTime(),
    }))

    return [...jobItems, ...notifItems].sort((a, b) => b.sortMs - a.sortMs)
  }, [groupedJobCards, notifications])

  // ── Auto-select first item on load ───────────────────────────────────────────
  useEffect(() => {
    if (jobsLoading || notifsLoading) return
    setSelectedItem((current) => {
      if (current) {
        if (
          current.kind === "jobcard" &&
          groupedJobCards.some((g) => g.jobCardId === current.jobCardId)
        ) {
          return current
        }
        if (
          current.kind === "notification" &&
          notifications.some((n) => n.id === current.id)
        ) {
          return current
        }
      }
      const first = leftItems[0]
      if (!first) return null
      if (first.kind === "jobcard") {
        return { kind: "jobcard", jobCardId: first.group.jobCardId }
      }
      return { kind: "notification", id: first.item.id }
    })
  }, [leftItems, jobsLoading, notifsLoading, groupedJobCards, notifications])

  // ── Derived selected values ───────────────────────────────────────────────────
  const selectedJobCard = useMemo(() => {
    if (!selectedItem || selectedItem.kind !== "jobcard") return null
    return (
      groupedJobCards.find((g) => g.jobCardId === selectedItem.jobCardId) ?? null
    )
  }, [selectedItem, groupedJobCards])

  const selectedNotification = useMemo(() => {
    if (!selectedItem || selectedItem.kind !== "notification") return null
    return notifications.find((n) => n.id === selectedItem.id) ?? null
  }, [selectedItem, notifications])

  // ── Task actions ──────────────────────────────────────────────────────────────
  const getRowAction = (
    row: TechnicianTaskRow
  ): "accept" | "start" | "complete" | null => {
    if (!canTakeActions || !currentEmployeeId || row.employeeId !== currentEmployeeId) {
      return null
    }
    if (row.status === "assigned") return "accept"
    if (row.status === "accepted") return "start"
    if (row.status === "in_progress") return "complete"
    return null
  }

  const getSectionAction = (
    row: TechnicianTaskRow,
    sectionKey: TimelineSectionKey
  ): "accept" | "start" | "complete" | null => {
    const action = getRowAction(row)
    if (!action) return null
    if (action === "accept" && sectionKey === "assigned") return action
    if (action === "start" && sectionKey === "accepted") return action
    if (action === "complete" && sectionKey === "started") return action
    return null
  }

  const runTaskAction = async (
    row: TechnicianTaskRow,
    action: "accept" | "start" | "complete"
  ) => {
    setActionError(null)
    setActionSuccess(null)
    setActionLoadingId(row.id)
    try {
      const response = await fetch(
        `/api/technician-jobs/${row.id}/${action}`,
        { method: "POST" }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to ${action} task`)
      }
      const label =
        action === "accept" ? "accepted" : action === "start" ? "started" : "completed"
      setActionSuccess(`Task ${label} successfully.`)
      setRefreshToken((prev) => prev + 1)
    } catch (err: any) {
      setActionError(err?.message || `Failed to ${action} task`)
    } finally {
      setActionLoadingId(null)
    }
  }

  // ── Timeline sections ─────────────────────────────────────────────────────────
  const timelineSections = useMemo<TimelineSection[]>(() => {
    if (!selectedJobCard) return []

    const assignedItems: TimelineItem[] = selectedJobCard.allocations.map((row) => ({
      id: `${row.id}-assigned`,
      title: row.technicianName,
      caption: row.taskAssigned || "Task not specified",
      time: row.assignedAt,
      metadata: [`Status: ${formatStatusLabel(row.status)}`],
      status: row.status,
      action: getSectionAction(row, "assigned"),
      row,
    }))

    const acceptedItems: TimelineItem[] = selectedJobCard.allocations
      .filter((row) => row.acceptedAt)
      .map((row) => ({
        id: `${row.id}-accepted`,
        title: row.technicianName,
        caption: row.taskAssigned || "Task not specified",
        time: row.acceptedAt,
        metadata: [`Accepted for ${selectedJobCard.vehicleNumber}`],
        status: "accepted",
        action: getSectionAction(row, "accepted"),
        row,
      }))

    const startedItems: TimelineItem[] = selectedJobCard.allocations
      .filter((row) => row.startedAt)
      .map((row) => ({
        id: `${row.id}-started`,
        title: row.technicianName,
        caption: row.taskAssigned || "Task not specified",
        time: row.startedAt,
        metadata: [`Current row status: ${formatStatusLabel(row.status)}`],
        status: row.status,
        action: getSectionAction(row, "started"),
        row,
      }))

    const completedItems: TimelineItem[] = selectedJobCard.allocations
      .filter((row) => row.completedAt)
      .map((row) => ({
        id: `${row.id}-completed`,
        title: row.technicianName,
        caption: row.taskAssigned || "Task not specified",
        time: row.completedAt,
        metadata: [`Turnaround: ${formatDuration(row.turnaroundMinutes, row.completedAt)}`],
        status: "completed",
        row,
      }))

    const readyItems: TimelineItem[] = []
    if (
      normalizeStatus(selectedJobCard.jobCardStatus) === "completed" ||
      ["ready", "delivered"].includes(normalizeStatus(selectedJobCard.vehicleStatus))
    ) {
      readyItems.push({
        id: `${selectedJobCard.jobCardId}-ready`,
        title: "Vehicle ready for delivery",
        caption: `Delivery status: ${formatStatusLabel(selectedJobCard.vehicleStatus)}`,
        time:
          normalizeStatus(selectedJobCard.vehicleStatus) === "ready"
            ? selectedJobCard.jobCardUpdatedAt
            : null,
        metadata: [
          "Exact ready-for-delivery actor is not stored in the current data model.",
          normalizeStatus(selectedJobCard.vehicleStatus) === "delivered"
            ? "Ready-for-delivery time was not stored separately before delivery."
            : "Ready-for-delivery timestamp is based on the latest saved jobcard update.",
        ],
        status: "ready",
      })
    }

    const deliveredItems: TimelineItem[] = []
    if (
      normalizeStatus(selectedJobCard.vehicleStatus) === "delivered" ||
      selectedJobCard.deliveryDate
    ) {
      deliveredItems.push({
        id: `${selectedJobCard.jobCardId}-delivered`,
        title: "Vehicle delivered",
        caption: `Delivery status: ${formatStatusLabel(selectedJobCard.vehicleStatus || "Delivered")}`,
        time: selectedJobCard.deliveryDate || selectedJobCard.jobCardUpdatedAt,
        metadata: ["Delivered-by actor is not stored in the current data model."],
        status: "delivered",
      })
    }

    return [
      {
        key: "created",
        title: "Job Card Created",
        description: "Initial jobcard creation for this vehicle.",
        emptyState: "Job card creation details are not available.",
        items: [
          {
            id: `${selectedJobCard.jobCardId}-created`,
            title: selectedJobCard.jobCardNumber,
            caption: `${selectedJobCard.customerName} • ${selectedJobCard.vehicleNumber}`,
            time: selectedJobCard.jobCardCreatedAt,
            metadata: [
              `Service date: ${formatDateOnly(selectedJobCard.serviceDate)}`,
              "Created-by actor is not stored in the current data model.",
            ],
          },
        ],
      },
      {
        key: "assigned",
        title: "Assigned",
        description: "Technicians allocated to this jobcard.",
        emptyState: "No technician allocations found for this jobcard.",
        items: assignedItems,
      },
      {
        key: "accepted",
        title: "Accepted",
        description: "Technicians who accepted the work.",
        emptyState: "No technician has accepted this jobcard yet.",
        items: acceptedItems,
      },
      {
        key: "started",
        title: "Started",
        description: "Work that has started on this vehicle.",
        emptyState: "Work has not started yet for this jobcard.",
        items: startedItems,
      },
      {
        key: "completed",
        title: "Completed",
        description: "Completed technician tasks for this jobcard.",
        emptyState: "No technician has completed work on this jobcard yet.",
        items: completedItems,
      },
      {
        key: "ready",
        title: "Ready For Delivery",
        description: "Vehicle readiness before final handover.",
        emptyState: "This vehicle is not marked ready for delivery yet.",
        items: readyItems,
      },
      {
        key: "delivered",
        title: "Delivered",
        description: "Final handover status for the vehicle.",
        emptyState: "This vehicle has not been delivered yet.",
        items: deliveredItems,
      },
    ]
  }, [selectedJobCard])

  // ── Notification actions ──────────────────────────────────────────────────────
  const markRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" })
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      )
    } catch {}
  }

  const deleteNotification = async (id: string) => {
    setNotifBusy(true)
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to delete notification")
      setNotifications((prev) => {
        const next = prev.filter((item) => item.id !== id)
        if (selectedItem?.kind === "notification" && selectedItem.id === id) {
          const firstLeft = leftItems.find(
            (li) => !(li.kind === "notification" && li.item.id === id)
          )
          if (!firstLeft) {
            setSelectedItem(null)
          } else if (firstLeft.kind === "jobcard") {
            setSelectedItem({ kind: "jobcard", jobCardId: firstLeft.group.jobCardId })
          } else {
            setSelectedItem({ kind: "notification", id: firstLeft.item.id })
          }
        }
        return next
      })
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setNotifBusy(false)
    }
  }

  // ── Loading / empty states ────────────────────────────────────────────────────
  const loading = jobsLoading || notifsLoading

  if (loading) {
    return (
      <p className="px-1 pt-1 text-sm text-muted-foreground">
        Loading notifications and job cards...
      </p>
    )
  }

  if (leftItems.length === 0) {
    return (
      <p className="px-1 pt-1 text-sm text-slate-500">
        No notifications or job card records found.
      </p>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="grid min-h-0 flex-1 h-full items-stretch gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
      {/* Left panel */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-900">
              {(() => {
                const unread = notifications.filter((n) => !n.isRead).length
                return unread > 0 ? `${unread} unread` : "All read"
              })()}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {leftItems.length} {leftItems.length === 1 ? "item" : "items"}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
          <div className="grid gap-2">
            {leftItems.map((li) => {
              if (li.kind === "jobcard") {
                const { group } = li
                const isSelected =
                  selectedItem?.kind === "jobcard" &&
                  selectedItem.jobCardId === group.jobCardId

                const stageBadgeKey = normalizeStatus(group.vehicleStatus) === "delivered"
                  ? "delivered"
                  : normalizeStatus(group.vehicleStatus) === "ready"
                    ? "ready"
                    : normalizeStatus(group.jobCardStatus) === "completed"
                      ? "completed"
                      : group.allocations.some((r) => r.status === "in_progress")
                        ? "in_progress"
                        : group.allocations.some((r) => r.status === "accepted")
                          ? "accepted"
                          : "assigned"

                return (
                  <button
                    key={`jc-${group.jobCardId}`}
                    type="button"
                    onClick={() =>
                      setSelectedItem({ kind: "jobcard", jobCardId: group.jobCardId })
                    }
                    className={`w-full max-w-[18rem] mx-auto rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-sky-300 bg-sky-50 shadow-sm shadow-sky-100"
                        : "border-slate-200 bg-slate-50/70 shadow-sm hover:bg-sky-100/60 hover:shadow"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {group.vehicleNumber}
                        </p>
                        {(`${group.vehicleMake} ${group.vehicleModel}`.trim()) && (
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {`${group.vehicleMake} ${group.vehicleModel}`.trim()}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400">
                          {formatDateTime(
                            group.jobCardUpdatedAt || group.serviceDate || group.jobCardCreatedAt
                          )}
                        </p>
                      </div>
                      <span
                        className={`mt-0.5 shrink-0 inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(stageBadgeKey)}`}
                      >
                        {getCurrentJobCardStage(group)}
                      </span>
                    </div>
                  </button>
                )
              }

              // notification item
              const { item } = li
              const isSelected =
                selectedItem?.kind === "notification" && selectedItem.id === item.id

              const approvalInfo = isApprovalNotification(item) ? parseApprovalInfo(item, approvalNameMap) : null

              return (
                <button
                  key={`notif-${item.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedItem({ kind: "notification", id: item.id })
                    if (!item.isRead) void markRead(item.id)
                    // Auto-remove jobcard notifications when opened — they are replaced
                    // by new events for the same job card, so reading = done.
                    if (item.refType === "jobcard") void deleteNotification(item.id)
                  }}
                  className={`w-full max-w-[18rem] mx-auto rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-sky-300 bg-sky-50 shadow-sm shadow-sky-100"
                      : item.isRead
                        ? "border-slate-200 bg-slate-50/70 shadow-sm hover:bg-sky-100/60 hover:shadow"
                        : "border-blue-200 bg-blue-50/50 shadow-sm hover:bg-sky-100/60 hover:shadow"
                  }`}
                >
                  {approvalInfo ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-bold text-slate-900">Access Request</p>
                        {!item.isRead && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-700">
                        {approvalInfo.name !== "-" && approvalInfo.mobile !== "-"
                          ? `${approvalInfo.name} - ${approvalInfo.mobile}`
                          : approvalInfo.name !== "-"
                            ? approvalInfo.name
                            : approvalInfo.mobile !== "-"
                              ? approvalInfo.mobile
                              : "-"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatApprovalDateTime(item.createdAt)}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{item.body}</p>
                        </div>
                        {!item.isRead && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="min-h-0">
        {/* Job card milestone view */}
        {selectedJobCard ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Milestones</h3>
                <p className="text-xs text-slate-500">
                  Section-wise technician and delivery progress for the selected vehicle.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${statusBadgeClass(
                    normalizeStatus(selectedJobCard.vehicleStatus) === "delivered"
                      ? "delivered"
                      : normalizeStatus(selectedJobCard.vehicleStatus) === "ready"
                        ? "ready"
                        : normalizeStatus(selectedJobCard.jobCardStatus) === "completed"
                          ? "completed"
                          : selectedJobCard.allocations.some((r) => r.status === "in_progress")
                            ? "in_progress"
                            : selectedJobCard.allocations.some((r) => r.status === "accepted")
                              ? "accepted"
                              : "assigned"
                  )}`}
                >
                  {getCurrentJobCardStage(selectedJobCard)}
                </span>
              </div>
            </div>

            {actionError ? (
              <p className="mb-3 text-sm text-red-600">{actionError}</p>
            ) : null}
            {actionSuccess ? (
              <p className="mb-3 text-sm text-emerald-700">{actionSuccess}</p>
            ) : null}

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="grid gap-3">
                {timelineSections.map((section, index) => (
                  <div key={section.key} className="relative pl-10">
                    {index < timelineSections.length - 1 ? (
                      <div className="absolute left-[11px] top-8 bottom-[-16px] w-px bg-slate-200" />
                    ) : null}
                    <div className="absolute left-0 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white">
                      {index + 1}
                    </div>
                    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">
                            {section.title}
                          </h4>
                          <p className="text-xs text-slate-500">{section.description}</p>
                        </div>
                        <span className="text-xs font-medium text-slate-400">
                          {section.items.length}{" "}
                          {section.items.length === 1 ? "entry" : "entries"}
                        </span>
                      </div>

                      {section.items.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {section.items.map((item) => {
                            const actionLabel =
                              item.action === "accept"
                                ? "Accept"
                                : item.action === "start"
                                  ? "Start"
                                  : item.action === "complete"
                                    ? "Complete"
                                    : null

                            return (
                              <div
                                key={item.id}
                                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {item.title}
                                      </p>
                                      {item.status ? (
                                        <span
                                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(item.status)}`}
                                        >
                                          {formatStatusLabel(item.status)}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {item.caption}
                                    </p>
                                    {item.metadata?.map((meta, metaIndex) => (
                                      <p
                                        key={`${item.id}-meta-${metaIndex}`}
                                        className="mt-1 text-xs text-slate-500"
                                      >
                                        {meta}
                                      </p>
                                    ))}
                                  </div>
                                  <div className="flex flex-col items-start gap-2 lg:items-end">
                                    <span className="text-xs font-medium text-slate-500">
                                      {item.time
                                        ? formatDateTime(item.time)
                                        : "Time not recorded separately"}
                                    </span>
                                    {item.row && item.action && actionLabel ? (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          runTaskAction(
                                            item.row as TechnicianTaskRow,
                                            item.action as "accept" | "start" | "complete"
                                          )
                                        }
                                        disabled={actionLoadingId === item.row.id}
                                        className="min-h-[38px] px-4"
                                      >
                                        {actionLoadingId === item.row.id
                                          ? "Please wait..."
                                          : actionLabel}
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-slate-500">{section.emptyState}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Notification detail view — approval */}
        {selectedNotification && isApprovalNotification(selectedNotification) ? (() => {
          const info = parseApprovalInfo(selectedNotification, approvalNameMap)
          const mobileNorm = normMobile(info.mobile !== "-" ? info.mobile : null)
          const userId = mobileNorm ? (approvalUserIdMap[mobileNorm] ?? null) : null
          return (
            <ApprovalsModule
              key={selectedNotification.id}
              filterUserId={userId ?? undefined}
              filterMobile={!userId && mobileNorm ? mobileNorm : undefined}
            />
          )
        })() : null}

        {/* Notification detail view — generic */}
        {selectedNotification && !isApprovalNotification(selectedNotification) ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="mb-6 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">
                  {selectedNotification.title}
                </h3>
                {!selectedNotification.isRead && (
                  <span className="shrink-0 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                    Unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {formatDateTime(selectedNotification.createdAt)}
              </p>
            </div>

            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm leading-relaxed text-slate-700">
                {selectedNotification.body}
              </p>
            </div>

            {notifError ? (
              <p className="mb-3 text-sm text-rose-600">{notifError}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              {selectedNotification.targetForm && onNavigate ? (
                <Button
                  onClick={() => {
                    if (!selectedNotification.isRead) void markRead(selectedNotification.id)
                    onNavigate(selectedNotification.targetForm!)
                  }}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Form
                </Button>
              ) : null}
              {!selectedNotification.isRead ? (
                <Button
                  variant="outline"
                  onClick={() => void markRead(selectedNotification.id)}
                  className="gap-2"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark as Read
                </Button>
              ) : null}
              <Button
                variant="ghost"
                disabled={notifBusy}
                onClick={() => void deleteNotification(selectedNotification.id)}
                className="gap-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        ) : null}

        {/* Nothing selected fallback */}
        {!selectedJobCard && !selectedNotification ? (
          <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/70">
            <p className="text-sm text-slate-400">Select an item to view details.</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"

type TaskStatus = "assigned" | "accepted" | "in_progress" | "completed" | "all"
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

interface EmployeeOption {
  employeeId: number
  empName: string
  isTechnician?: boolean | null
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

const VEHICLE_OUTER_BOTTOM_GAP_PX = 12

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

export function TechnicianTaskDetailsForm({
  currentEmployeeId = null,
  externalSearch,
  onExternalSearchChange,
}: {
  currentEmployeeId?: number | null
  externalSearch?: string
  onExternalSearchChange?: (value: string) => void
}) {
  const isTechnicianScoped = Number.isInteger(currentEmployeeId)
  const canTakeActions = Number.isInteger(currentEmployeeId)
  const [rows, setRows] = useState<TechnicianTaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [status, setStatus] = useState<TaskStatus>("all")
  const [search, setSearch] = useState("")
  const effectiveSearch = externalSearch !== undefined ? externalSearch : search
  const [employeeNames, setEmployeeNames] = useState<string[]>([])
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1)
  const [selectedJobCardId, setSelectedJobCardId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const hadFocusBeforeClickRef = useRef(false)
  const vehicleScrollRef = useRef<HTMLDivElement | null>(null)
  const milestoneScrollRef = useRef<HTMLDivElement | null>(null)

  const setSearchValue = (value: string) => {
    if (externalSearch !== undefined) {
      onExternalSearchChange?.(value)
      return
    }
    setSearch(value)
  }

  useEffect(() => {
    let active = true

    const loadEmployeeNames = async () => {
      try {
        const response = await fetch("/api/employees", { cache: "no-store" })
        const data = await response.json()

        if (!response.ok || !Array.isArray(data) || !active) {
          return
        }

        const names = data
          .filter((employee: EmployeeOption) => employee?.isTechnician)
          .map((employee: EmployeeOption) => (employee.empName || "").trim())
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b))

        setEmployeeNames(Array.from(new Set(names)))
      } catch {
        if (active) {
          setEmployeeNames([])
        }
      }
    }

    loadEmployeeNames()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const fetchRows = async () => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (status && status !== "all") {
          params.set("status", status)
        }
        if (!isTechnicianScoped && effectiveSearch.trim()) {
          params.set("search", effectiveSearch.trim())
        }
        if (currentEmployeeId) {
          params.set("employeeId", String(currentEmployeeId))
        }

        const response = await fetch(`/api/technician-task-details?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to fetch technician tasks")
        }

        if (isMounted) {
          setRows(Array.isArray(data.allocations) ? data.allocations : [])
        }
      } catch (fetchError: any) {
        if (fetchError?.name === "AbortError") return
        if (isMounted) {
          setRows([])
          setError(fetchError?.message || "Failed to fetch technician tasks")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    const debounceId = window.setTimeout(fetchRows, 220)

    return () => {
      isMounted = false
      controller.abort()
      window.clearTimeout(debounceId)
    }
  }, [status, effectiveSearch, currentEmployeeId, isTechnicianScoped, refreshToken])

  const runTaskAction = async (row: TechnicianTaskRow, action: "accept" | "start" | "complete") => {
    setActionError(null)
    setActionSuccess(null)
    setActionLoadingId(row.id)

    try {
      const response = await fetch(`/api/technician-jobs/${row.id}/${action}`, {
        method: "POST",
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to ${action} task`)
      }

      const label = action === "accept" ? "accepted" : action === "start" ? "started" : "completed"
      setActionSuccess(`Task ${label} successfully.`)
      setRefreshToken((prev) => prev + 1)
    } catch (actionFetchError: any) {
      setActionError(actionFetchError?.message || `Failed to ${action} task`)
    } finally {
      setActionLoadingId(null)
    }
  }

  const getRowAction = (row: TechnicianTaskRow): "accept" | "start" | "complete" | null => {
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
          (a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime()
        ),
      }))
      .sort((a, b) => {
        const aTime = new Date(a.serviceDate || a.jobCardCreatedAt || 0).getTime()
        const bTime = new Date(b.serviceDate || b.jobCardCreatedAt || 0).getTime()
        return bTime - aTime
      })
  }, [rows])

  useEffect(() => {
    if (groupedJobCards.length === 0) {
      setSelectedJobCardId(null)
      return
    }

    setSelectedJobCardId((current) => {
      if (current && groupedJobCards.some((group) => group.jobCardId === current)) {
        return current
      }
      return groupedJobCards[0].jobCardId
    })
  }, [groupedJobCards])

  const selectedJobCard = useMemo(
    () => groupedJobCards.find((group) => group.jobCardId === selectedJobCardId) || null,
    [groupedJobCards, selectedJobCardId]
  )

  const filteredEmployeeNames = useMemo(() => {
    const query = effectiveSearch.trim().toLowerCase()
    const names = query
      ? employeeNames.filter((name) => name.toLowerCase().includes(query))
      : employeeNames

    return names.slice(0, 8)
  }, [employeeNames, effectiveSearch])

  const selectSuggestionByIndex = (index: number) => {
    if (index < 0 || index >= filteredEmployeeNames.length) {
      return
    }

    setSearchValue(filteredEmployeeNames[index])
    setShowSearchSuggestions(false)
    setHighlightedSuggestionIndex(-1)
  }

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
        time: normalizeStatus(selectedJobCard.vehicleStatus) === "ready" ? selectedJobCard.jobCardUpdatedAt : null,
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
    if (normalizeStatus(selectedJobCard.vehicleStatus) === "delivered" || selectedJobCard.deliveryDate) {
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

  const showInlineSearch = !isTechnicianScoped && externalSearch === undefined

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      {showInlineSearch ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Popover
              open={showSearchSuggestions}
              onOpenChange={(open) => {
                setShowSearchSuggestions(open)
                if (!open) {
                  setHighlightedSuggestionIndex(-1)
                }
              }}
            >
              <PopoverAnchor asChild>
                <div className="sm:w-[26rem]">
                  <Input
                    ref={searchInputRef}
                    value={effectiveSearch}
                    onChange={(event) => {
                      setSearchValue(event.target.value)
                      setShowSearchSuggestions(true)
                      setHighlightedSuggestionIndex(-1)
                    }}
                    onMouseDown={() => {
                      hadFocusBeforeClickRef.current =
                        document.activeElement === searchInputRef.current
                    }}
                    onFocus={() => {
                      setShowSearchSuggestions(true)
                      setHighlightedSuggestionIndex(filteredEmployeeNames.length > 0 ? 0 : -1)
                    }}
                    onClick={() => {
                      if (hadFocusBeforeClickRef.current) {
                        setShowSearchSuggestions((prev) => !prev)
                      } else {
                        setShowSearchSuggestions(true)
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault()
                        setShowSearchSuggestions(true)
                        setHighlightedSuggestionIndex((prev) => {
                          if (filteredEmployeeNames.length === 0) return -1
                          if (prev < 0) return 0
                          return Math.min(prev + 1, filteredEmployeeNames.length - 1)
                        })
                        return
                      }

                      if (event.key === "ArrowUp") {
                        event.preventDefault()
                        setHighlightedSuggestionIndex((prev) => {
                          if (filteredEmployeeNames.length === 0) return -1
                          if (prev <= 0) return 0
                          return prev - 1
                        })
                        return
                      }

                      if (event.key === "Enter") {
                        if (showSearchSuggestions && highlightedSuggestionIndex >= 0) {
                          event.preventDefault()
                          selectSuggestionByIndex(highlightedSuggestionIndex)
                        }
                        return
                      }

                      if (event.key === "Escape" || event.key === "Tab") {
                        setShowSearchSuggestions(false)
                        setHighlightedSuggestionIndex(-1)
                      }
                    }}
                    placeholder="Search by technician, task, job card, or vehicle"
                    autoComplete="off"
                  />
                </div>
              </PopoverAnchor>
              <PopoverContent
                align="start"
                sideOffset={6}
                onOpenAutoFocus={(event) => event.preventDefault()}
                className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
              >
                <div className="max-h-60 dropdown-scroll">
                  {filteredEmployeeNames.length > 0 ? (
                    filteredEmployeeNames.map((name, index) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          selectSuggestionByIndex(index)
                        }}
                        onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                        className={`dropdown-item text-left ${
                          highlightedSuggestionIndex === index ? "selected" : ""
                        }`}
                      >
                        {name}
                      </button>
                    ))
                  ) : (
                    <div className="dropdown-empty-state">No matching technicians</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      {actionSuccess ? <p className="text-sm text-emerald-700">{actionSuccess}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading technician task details...</p> : null}

      {!loading && groupedJobCards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No technician task records found.</p>
      ) : null}

      {groupedJobCards.length > 0 ? (
        <div className="grid min-h-0 flex-1 items-stretch gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ paddingBottom: `${VEHICLE_OUTER_BOTTOM_GAP_PX}px` }}>
            <div className="px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Vehicles</h3>
              <p className="text-xs text-slate-500">Select a vehicle to view its milestones.</p>
            </div>
            <div
              ref={vehicleScrollRef}
              className="relative flex-1 min-h-0 overflow-y-auto px-3"
            >
              <div className="grid gap-3">
                {groupedJobCards.map((group) => {
                  const isSelected = group.jobCardId === selectedJobCardId
                  return (
                    <button
                      key={group.jobCardId}
                      data-vehicle-row
                      type="button"
                      onClick={() => setSelectedJobCardId(group.jobCardId)}
                      className={`h-full min-h-0 w-full rounded-xl border p-3 text-left transition xl:h-[58px] xl:py-2 ${
                        isSelected
                          ? "border-sky-300 bg-sky-50 shadow-sm shadow-sky-100"
                          : "border-slate-200 bg-slate-50/70 shadow-sm hover:bg-sky-100/60 hover:shadow"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-slate-900">{group.vehicleNumber}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-600">
                            {`${`${group.vehicleMake || "-"} ${group.vehicleModel || ""}`.trim()} - ${formatDateCompact(group.serviceDate)}`}
                          </p>
                        </div>
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${statusBadgeClass(
                            normalizeStatus(group.vehicleStatus) === "delivered"
                              ? "delivered"
                              : normalizeStatus(group.vehicleStatus) === "ready"
                                ? "ready"
                                : normalizeStatus(group.jobCardStatus) === "completed"
                                  ? "completed"
                                  : group.allocations.some((row) => row.status === "in_progress")
                                    ? "in_progress"
                                    : group.allocations.some((row) => row.status === "accepted")
                                      ? "accepted"
                                      : "assigned"
                          )}`}
                        >
                          {getCurrentJobCardStage(group)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0">
            {selectedJobCard ? (
              <>
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Milestones</h3>
                      <p className="text-xs text-slate-500">Section-wise technician and delivery progress for the selected vehicle.</p>
                    </div>
                    <div className="flex w-full items-center gap-3 text-left sm:ml-auto sm:w-auto sm:shrink-0 sm:self-start">
                      <p className="shrink-0 text-xs text-muted-foreground">Sort By</p>
                      <div className="w-full sm:w-56">
                        <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                          <SelectTrigger
                            className="w-full text-xs py-0"
                            style={{ height: "1.875rem", minHeight: "unset" }}
                          >
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="text-xs">All Status</SelectItem>
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div
                    ref={milestoneScrollRef}
                    className="flex-1 min-h-0 overflow-y-auto pr-1"
                  >
                    <div className="grid gap-3">
                    {timelineSections.map((section, index) => (
                      <div key={section.key} data-milestone-row className="relative pl-10">
                        {index < timelineSections.length - 1 ? (
                          <div className="absolute left-[11px] top-8 bottom-[-16px] w-px bg-slate-200" />
                        ) : null}
                        <div className="absolute left-0 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white">
                          {index + 1}
                        </div>
                        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-900">{section.title}</h4>
                              <p className="text-xs text-slate-500">{section.description}</p>
                            </div>
                            <span className="text-xs font-medium text-slate-400">
                              {section.items.length} {section.items.length === 1 ? "entry" : "entries"}
                            </span>
                          </div>

                          {section.items.length > 0 ? (
                            <div className="mt-3 flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
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
                                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                          {item.status ? (
                                            <span
                                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
                                                item.status
                                              )}`}
                                            >
                                              {formatStatusLabel(item.status)}
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="mt-1 text-sm text-slate-600">{item.caption}</p>
                                        {item.metadata?.map((meta, metaIndex) => (
                                          <p key={`${item.id}-meta-${metaIndex}`} className="mt-1 text-xs text-slate-500">
                                            {meta}
                                          </p>
                                        ))}
                                      </div>

                                      <div className="flex flex-col items-start gap-2 lg:items-end">
                                        <span className="text-xs font-medium text-slate-500">
                                          {item.time ? formatDateTime(item.time) : "Time not recorded separately"}
                                        </span>
                                        {item.row && item.action && actionLabel ? (
                                          <Button
                                            size="sm"
                                            onClick={() => runTaskAction(item.row as TechnicianTaskRow, item.action as "accept" | "start" | "complete")}
                                            disabled={actionLoadingId === item.row.id}
                                            className="min-h-[38px] px-4"
                                          >
                                            {actionLoadingId === item.row.id ? "Please wait..." : actionLabel}
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
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
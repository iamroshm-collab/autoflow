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

interface TechnicianTaskRow {
  id: string
  employeeId: number
  technicianName: string
  jobCardId: string
  jobCardNumber: string
  vehicleNumber: string
  vehicleMake?: string
  vehicleModel?: string
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

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
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
  return "bg-slate-100 text-slate-700"
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
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const hadFocusBeforeClickRef = useRef(false)

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
        // If employee, filter by their employeeId
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

  const summary = useMemo(() => {
    const total = rows.length
    const completed = rows.filter((row) => row.status === "completed").length
    const active = rows.filter((row) => row.status !== "completed").length
    return { total, completed, active }
  }, [rows])

  const filteredEmployeeNames = useMemo(() => {
    const query = effectiveSearch.trim().toLowerCase()
    const names = query
      ? employeeNames.filter((name) => name.toLowerCase().includes(query))
      : employeeNames

    return names.slice(0, 8)
  }, [employeeNames, search])

  const selectSuggestionByIndex = (index: number) => {
    if (index < 0 || index >= filteredEmployeeNames.length) {
      return
    }

    setSearch(filteredEmployeeNames[index])
    setShowSearchSuggestions(false)
    setHighlightedSuggestionIndex(-1)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 bg-slate-50">
          <p className="text-xs text-muted-foreground">Total Tasks</p>
          <p className="text-lg font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-lg border p-3 bg-emerald-50">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-lg font-semibold">{summary.completed}</p>
        </div>
        <div className="rounded-lg border p-3 bg-amber-50">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-lg font-semibold">{summary.active}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {!isTechnicianScoped && externalSearch === undefined ? (
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
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
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
          ) : null}
          <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
            <SelectTrigger className="h-10 w-[9rem]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      {actionSuccess ? <p className="text-sm text-emerald-700">{actionSuccess}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading technician task details...</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No technician task records found.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                {isTechnicianScoped ? (
                  <>
                    <th className="px-3 py-2 font-semibold text-left">Task</th>
                    <th className="px-3 py-2 font-semibold text-center">Actions</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-2 font-semibold text-left">Technician</th>
                    <th className="px-3 py-2 font-semibold min-w-[18rem] text-left">Task</th>
                    <th className="px-3 py-2 font-semibold text-center">Status</th>
                    <th className="px-3 py-2 font-semibold text-center">Assigned</th>
                    <th className="px-3 py-2 font-semibold text-center">Accepted</th>
                    <th className="px-3 py-2 font-semibold text-center">Started</th>
                    <th className="px-3 py-2 font-semibold text-center">Completed</th>
                    <th className="px-3 py-2 font-semibold text-center">Turn Around Time</th>
                    {canTakeActions ? <th className="px-3 py-2 font-semibold text-center">Actions</th> : null}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowAction = getRowAction(row)
                const actionLabel = rowAction === "accept" ? "Accept" : rowAction === "start" ? "Start" : rowAction === "complete" ? "Complete" : null

                return (
                  <tr key={row.id} className="border-t align-top">
                    {isTechnicianScoped ? (
                      <>
                        <td className="px-3 py-2 min-w-[12rem] align-top text-left">
                          <p className="font-medium leading-tight">{row.vehicleNumber || "-"}</p>
                          <p className="text-xs text-muted-foreground leading-tight mt-1">{`${row.vehicleMake || "-"} ${row.vehicleModel || ""}`.trim()}</p>
                          <p className="leading-5 break-words overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] mt-1">
                            {row.taskAssigned || "-"}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {rowAction && actionLabel ? (
                            <Button
                              size="sm"
                              onClick={() => runTaskAction(row, rowAction)}
                              disabled={actionLoadingId === row.id}
                              className="px-4 py-2 min-h-[40px]"
                            >
                              {actionLoadingId === row.id ? "Please wait..." : actionLabel}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-left">
                          <p className="font-medium">{row.technicianName}</p>
                          <p className="text-xs text-muted-foreground">Vehicle: {row.vehicleNumber || "-"}</p>
                        </td>
                        <td className="px-3 py-2 min-w-[18rem] text-left">{row.taskAssigned || "-"}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${statusBadgeClass(row.status)}`}>
                            {row.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">{formatDateTime(row.assignedAt)}</td>
                        <td className="px-3 py-2 text-center">{formatDateTime(row.acceptedAt)}</td>
                        <td className="px-3 py-2 text-center">{formatDateTime(row.startedAt)}</td>
                        <td className="px-3 py-2 text-center">{formatDateTime(row.completedAt)}</td>
                        <td className="px-3 py-2 text-center">{formatDuration(row.turnaroundMinutes, row.completedAt)}</td>
                        {canTakeActions ? (
                          <td className="px-3 py-2 text-center">
                            {rowAction && actionLabel ? (
                              <Button
                                size="sm"
                                onClick={() => runTaskAction(row, rowAction)}
                                disabled={actionLoadingId === row.id}
                                className="px-4 py-2 min-h-[40px]"
                              >
                                {actionLoadingId === row.id ? "Please wait..." : actionLabel}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        ) : null}
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, CheckCircle, Play, Flag, Clock, Wrench, ChevronRight, Car, User, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"

// ── Types ────────────────────────────────────────────────────────────────────

type AllocationStatus = "assigned" | "accepted" | "in_progress" | "completed"

type AllocationSummary = {
  id: string
  jobId: string
  status: AllocationStatus
  taskAssigned: string
  assignedAt: string
  acceptedAt: string | null
  startedAt: string | null
  completedAt: string | null
  jobCard: {
    id: string
    jobCardNumber: string
    jobcardStatus: string
    serviceDate: string
    vehicle: { registrationNumber: string; make: string; model: string; year?: number | null }
    customer: { name: string }
  }
}

type ServiceLine = {
  id: string
  sl: number
  description: string
  sparePart?: string | null
  qnty: number
  salePrice: number
  totalAmount: number
}

type JobDetail = {
  id: string
  jobCardNumber: string
  jobcardStatus: string
  serviceDate: string
  deliveryDate?: string | null
  vehicle: { registrationNumber: string; make: string; model: string; year?: number | null }
  customer: { name: string; mobileNo?: string | null }
  serviceDescriptions: ServiceLine[]
  technicianAllocations: {
    id: string
    status: AllocationStatus
    taskAssigned: string
    assignedAt: string
    acceptedAt: string | null
    startedAt: string | null
    completedAt: string | null
    earningAmount: number
  }[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AllocationStatus, string> = {
  assigned: "Assigned",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
}

const STATUS_COLORS: Record<AllocationStatus, string> = {
  assigned: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-slate-400 w-24 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-700 truncate">{value}</span>
    </div>
  )
}

function MilestoneRow({
  label,
  timestamp,
  done,
}: {
  label: string
  timestamp?: string | null
  done: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${
          done ? "bg-emerald-500" : "bg-slate-200"
        }`}
      >
        {done && <CheckCircle className="w-3 h-3 text-white" />}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? "text-slate-800" : "text-slate-400"}`}>{label}</p>
        {timestamp && <p className="text-xs text-slate-400 mt-0.5">{fmtDate(timestamp)}</p>}
      </div>
    </div>
  )
}

// ── Main Panel ───────────────────────────────────────────────────────────────

interface EmployeeJobPanelProps {
  initialJobId?: string | null
  onClose: () => void
}

export function EmployeeJobPanel({ initialJobId, onClose }: EmployeeJobPanelProps) {
  const [allocations, setAllocations] = useState<AllocationSummary[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId ?? null)
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState("")
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Load allocation list
  useEffect(() => {
    const load = async () => {
      setLoadingList(true)
      try {
        const res = await fetch("/api/jobs/assigned", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (mountedRef.current) setAllocations(Array.isArray(data.allocations) ? data.allocations : [])
      } catch {
      } finally {
        if (mountedRef.current) setLoadingList(false)
      }
    }
    void load()
  }, [])

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedJobId) { setJobDetail(null); return }
    const load = async () => {
      setLoadingDetail(true)
      setActionError("")
      try {
        const res = await fetch(`/api/jobs/${selectedJobId}`, { cache: "no-store" })
        if (!res.ok) { setJobDetail(null); return }
        const data = await res.json()
        if (mountedRef.current) setJobDetail(data.jobCard ?? null)
      } catch {
        if (mountedRef.current) setJobDetail(null)
      } finally {
        if (mountedRef.current) setLoadingDetail(false)
      }
    }
    void load()
  }, [selectedJobId])

  const performAction = useCallback(async (action: "accept" | "start" | "complete") => {
    if (!selectedJobId) return
    setActionLoading(true)
    setActionError("")

    // Optimistic update
    const prevAllocations = allocations
    const prevDetail = jobDetail
    const nextStatus: AllocationStatus =
      action === "accept" ? "accepted" : action === "start" ? "in_progress" : "completed"
    const now = new Date().toISOString()

    setAllocations((prev) =>
      prev.map((a) =>
        a.jobId === selectedJobId
          ? {
              ...a,
              status: nextStatus,
              acceptedAt: action === "accept" ? now : a.acceptedAt,
              startedAt: action === "start" ? now : a.startedAt,
              completedAt: action === "complete" ? now : a.completedAt,
            }
          : a
      )
    )
    setJobDetail((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        technicianAllocations: prev.technicianAllocations.map((al) => ({
          ...al,
          status: nextStatus,
          acceptedAt: action === "accept" ? now : al.acceptedAt,
          startedAt: action === "start" ? now : al.startedAt,
          completedAt: action === "complete" ? now : al.completedAt,
        })),
      }
    })

    try {
      const res = await fetch(`/api/jobs/${selectedJobId}/${action}`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to ${action} job`)
      }
    } catch (err) {
      // Rollback
      if (mountedRef.current) {
        setAllocations(prevAllocations)
        setJobDetail(prevDetail)
        setActionError(err instanceof Error ? err.message : `Failed to ${action} job`)
      }
    } finally {
      if (mountedRef.current) setActionLoading(false)
    }
  }, [selectedJobId, allocations, jobDetail])

  /** Reverse a previously accepted job allocation back to "assigned". */
  const performUnaccept = useCallback(async () => {
    if (!selectedJobId) return
    setActionLoading(true)
    setActionError("")

    const prevAllocations = allocations
    const prevDetail = jobDetail

    // Optimistic update
    setAllocations((prev) =>
      prev.map((a) =>
        a.jobId === selectedJobId ? { ...a, status: "assigned" as AllocationStatus, acceptedAt: null } : a
      )
    )
    setJobDetail((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        technicianAllocations: prev.technicianAllocations.map((al) => ({
          ...al,
          status: "assigned" as AllocationStatus,
          acceptedAt: null,
        })),
      }
    })

    try {
      const res = await fetch(`/api/jobs/${selectedJobId}/unaccept`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to reverse acceptance")
      }
    } catch (err) {
      if (mountedRef.current) {
        setAllocations(prevAllocations)
        setJobDetail(prevDetail)
        setActionError(err instanceof Error ? err.message : "Failed to reverse acceptance")
      }
    } finally {
      if (mountedRef.current) setActionLoading(false)
    }
  }, [selectedJobId, allocations, jobDetail])

  const myAllocation = jobDetail?.technicianAllocations[0] ?? null
  const myStatus = myAllocation?.status ?? "assigned"

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    // Full-screen overlay sitting on top of main content
    <div
      className="fixed inset-0 z-40 flex flex-col bg-slate-100"
      role="dialog"
      aria-modal="true"
      aria-label="Assigned Jobs"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 bg-white border-b border-slate-100 rounded-t-2xl shrink-0">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-800">Assigned Jobs</h2>
          {allocations.length > 0 && (
            <span className="ml-1 text-xs font-medium text-slate-400">{allocations.length} total</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
          aria-label="Close assigned jobs panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0 gap-[1mm] mt-[1mm]">
        {/* Left: job list */}
        <div className="w-72 shrink-0 flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            My Jobs
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="px-3 py-6 text-sm text-slate-400 text-center">Loading…</div>
            ) : allocations.length === 0 ? (
              <div className="px-3 py-6 text-sm text-slate-400 text-center">No jobs assigned yet.</div>
            ) : (
              allocations.map((a) => {
                const isSelected = selectedJobId === a.jobId
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedJobId(a.jobId)}
                    className={`w-full text-left px-3 py-3 border-b border-slate-50 flex items-start gap-2 transition-colors ${
                      isSelected ? "bg-[#eef2ff]" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-slate-700 truncate">
                          {a.jobCard.jobCardNumber}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[a.status]}`}
                        >
                          {STATUS_LABELS[a.status]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {a.jobCard.vehicle.registrationNumber} · {a.jobCard.vehicle.make} {a.jobCard.vehicle.model}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fmtDateShort(a.assignedAt)}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-300 mt-1" />
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right: job detail */}
        <div className="flex-1 min-w-0 flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {!selectedJobId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <Wrench className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a job from the list</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-slate-400">Loading job details…</p>
            </div>
          ) : !jobDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-red-500">Could not load job details.</p>
            </div>
          ) : (
            <>
              {/* ── Static detail header ── */}
              <div className="px-6 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs text-slate-400 font-mono">{jobDetail.jobCardNumber}</span>
                    <h2 className="text-lg font-semibold text-slate-800 mt-0.5">
                      {jobDetail.vehicle.registrationNumber}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {jobDetail.vehicle.make} {jobDetail.vehicle.model}
                      {jobDetail.vehicle.year ? ` (${jobDetail.vehicle.year})` : ""}
                      {" · "}{jobDetail.customer.name}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[myStatus]}`}
                  >
                    {STATUS_LABELS[myStatus]}
                  </span>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">

                {/* Vehicle & Customer + Task Assigned cards */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Vehicle & Customer */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5" /> Vehicle
                    </h3>
                    <div className="space-y-1.5">
                      <InfoRow label="Registration" value={jobDetail.vehicle.registrationNumber} />
                      <InfoRow label="Make / Model" value={`${jobDetail.vehicle.make} ${jobDetail.vehicle.model}`} />
                      {jobDetail.vehicle.year && (
                        <InfoRow label="Year" value={String(jobDetail.vehicle.year)} />
                      )}
                    </div>
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <User className="w-3.5 h-3.5" /> Customer
                      </h3>
                      <InfoRow label="Name" value={jobDetail.customer.name} />
                      {jobDetail.customer.mobileNo && (
                        <InfoRow label="Mobile" value={jobDetail.customer.mobileNo} />
                      )}
                    </div>
                  </div>

                  {/* Task Assigned */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" /> Task Assigned
                      </h3>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[myStatus]}`}
                      >
                        {STATUS_LABELS[myStatus]}
                      </span>
                    </div>
                    {myAllocation?.taskAssigned ? (
                      <p className="text-sm text-slate-700 leading-relaxed">{myAllocation.taskAssigned}</p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No specific task assigned</p>
                    )}
                    {myAllocation && myAllocation.earningAmount > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-400 mb-0.5">Earning</p>
                        <p className="text-sm font-semibold text-emerald-600">
                          ₹{myAllocation.earningAmount.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Your Actions */}
                {myStatus !== "completed" ? (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Actions</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {myStatus === "assigned" && (
                        <Button
                          size="sm"
                          onClick={() => void performAction("accept")}
                          disabled={actionLoading}
                          className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Accept Job
                        </Button>
                      )}
                      {(myStatus === "assigned" || myStatus === "accepted") && (
                        <Button
                          size="sm"
                          onClick={() => void performAction("start")}
                          disabled={actionLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                        >
                          <Play className="w-4 h-4" />
                          Start Work
                        </Button>
                      )}
                      {myStatus === "in_progress" && (
                        <Button
                          size="sm"
                          onClick={() => void performAction("complete")}
                          disabled={actionLoading}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          <Flag className="w-4 h-4" />
                          Mark Complete
                        </Button>
                      )}
                      {/* Reverse Accept — only when status is "accepted" (not yet started) */}
                      {myStatus === "accepted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm("Reverse your acceptance? The job will go back to assigned.")) {
                              void performUnaccept()
                            }
                          }}
                          disabled={actionLoading}
                          className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-1.5"
                        >
                          <Undo2 className="w-4 h-4" />
                          Reverse Accept
                        </Button>
                      )}
                    </div>
                    {actionError && (
                      <p className="text-sm text-red-500 mt-2">{actionError}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <CheckCircle className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
                    <p className="text-sm font-medium text-emerald-800">Job completed</p>
                    {myAllocation?.completedAt && (
                      <p className="text-xs text-emerald-600 mt-0.5">{fmtDate(myAllocation.completedAt)}</p>
                    )}
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Timeline</h3>
                  <div className="space-y-3 pl-1">
                    <MilestoneRow label="Assigned" timestamp={myAllocation?.assignedAt} done={true} />
                    <MilestoneRow
                      label="Accepted"
                      timestamp={myAllocation?.acceptedAt}
                      done={myStatus !== "assigned"}
                    />
                    <MilestoneRow
                      label="Work Started"
                      timestamp={myAllocation?.startedAt}
                      done={myStatus === "in_progress" || myStatus === "completed"}
                    />
                    <MilestoneRow
                      label="Completed"
                      timestamp={myAllocation?.completedAt}
                      done={myStatus === "completed"}
                    />
                  </div>
                </div>

                {/* Service descriptions */}
                {jobDetail.serviceDescriptions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Services / Work Items
                    </h3>
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">#</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Description</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Qty</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobDetail.serviceDescriptions.map((s) => (
                            <tr key={s.id} className="border-t border-slate-50">
                              <td className="px-3 py-2 text-slate-400 text-xs">{s.sl}</td>
                              <td className="px-3 py-2 text-slate-700">
                                {s.description}
                                {s.sparePart && (
                                  <span className="ml-1.5 text-xs text-slate-400">({s.sparePart})</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500">{s.qnty}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-700">
                                ₹{s.totalAmount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

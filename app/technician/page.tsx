"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  registerTechnicianPushToken,
  setupTechnicianPushForegroundListener,
} from "@/lib/firebase-web-push"

type AllocationStatus = "assigned" | "accepted" | "in_progress" | "completed"

interface Allocation {
  id: string
  status: AllocationStatus
  taskAssigned?: string | null
  assignedAt: string
  acceptedAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  earningAmount?: number | null
  jobCard: {
    id: string
    jobCardNumber?: string | null
    customer?: { name?: string | null } | null
    vehicle?: {
      registrationNumber?: string | null
      make?: string | null
      model?: string | null
    } | null
  }
}

const TECHNICIAN_STORAGE_KEY = "technician_id"
const TECHNICIAN_PUSH_ENABLED_PREFIX = "technician_push_enabled_"

function statusClassName(status: AllocationStatus) {
  if (status === "assigned") return "bg-amber-100 text-amber-800"
  if (status === "accepted") return "bg-blue-100 text-blue-800"
  if (status === "in_progress") return "bg-violet-100 text-violet-800"
  return "bg-emerald-100 text-emerald-800"
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

export default function TechnicianPage() {
  const isSecureContextClient = typeof window !== "undefined" ? window.isSecureContext : true
  const [technicianIdInput, setTechnicianIdInput] = useState("")
  const [activeTechnicianId, setActiveTechnicianId] = useState<number | null>(null)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [showAllJobs, setShowAllJobs] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [tokenSaving, setTokenSaving] = useState(false)
  const [tokenMessage, setTokenMessage] = useState<string | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [newJobCount, setNewJobCount] = useState(0)
  const seenAllocationIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedAllocationsRef = useRef(false)

  useEffect(() => {
    const stored =
      window.localStorage.getItem(TECHNICIAN_STORAGE_KEY) ||
      window.localStorage.getItem("technician_employee_id")
    if (!stored) return
    const parsed = Number(stored)
    if (!Number.isInteger(parsed)) return
    window.localStorage.setItem(TECHNICIAN_STORAGE_KEY, String(parsed))
    setActiveTechnicianId(parsed)
    setTechnicianIdInput(String(parsed))
  }, [])

  async function loadJobs(technicianId: number, includeCompleted: boolean) {
    setLoadingJobs(true)
    setJobsError(null)
    try {
      const route = includeCompleted
        ? `/api/technician/jobs?technicianId=${technicianId}`
        : `/api/technician/jobs?technicianId=${technicianId}&pending=true`
      const response = await fetch(route, {
        cache: "no-store",
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load jobs")
      }
      setAllocations(Array.isArray(data.allocations) ? data.allocations : [])
    } catch (error: any) {
      setJobsError(error?.message || "Failed to load jobs")
      setAllocations([])
    } finally {
      setLoadingJobs(false)
    }
  }

  useEffect(() => {
    if (!activeTechnicianId) return
    void loadJobs(activeTechnicianId, showAllJobs)
  }, [activeTechnicianId, showAllJobs])

  useEffect(() => {
    if (!activeTechnicianId) return

    const intervalId = window.setInterval(() => {
      void loadJobs(activeTechnicianId, showAllJobs)
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeTechnicianId, showAllJobs])

  useEffect(() => {
    if (!activeTechnicianId) return

    const currentIds = new Set(allocations.map((item) => item.id))

    if (showAllJobs) {
      seenAllocationIdsRef.current = currentIds
      if (!hasInitializedAllocationsRef.current) {
        hasInitializedAllocationsRef.current = true
      }
      return
    }

    if (!hasInitializedAllocationsRef.current) {
      seenAllocationIdsRef.current = currentIds
      hasInitializedAllocationsRef.current = true
      return
    }

    const freshIds = [...currentIds].filter((allocationId) => !seenAllocationIdsRef.current.has(allocationId))
    if (freshIds.length > 0) {
      setNewJobCount((prev) => prev + freshIds.length)
    }
    seenAllocationIdsRef.current = currentIds
  }, [activeTechnicianId, allocations, showAllJobs])

  useEffect(() => {
    if (!activeTechnicianId) {
      setNotificationsEnabled(false)
      return
    }

    const storageKey = `${TECHNICIAN_PUSH_ENABLED_PREFIX}${activeTechnicianId}`
    const enabled =
      window.localStorage.getItem(storageKey) === "1" ||
      (typeof Notification !== "undefined" && Notification.permission === "granted")
    setNotificationsEnabled(enabled)
  }, [activeTechnicianId])

  useEffect(() => {
    if (!activeTechnicianId) return

    let unsubscribe: (() => void) | null = null

    void setupTechnicianPushForegroundListener()
      .then((fn) => {
        if (typeof fn === "function") {
          unsubscribe = fn
        }
      })
      .catch((error) => {
        console.error("Failed to start push foreground listener", error)
      })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [activeTechnicianId])

  const sortedAllocations = useMemo(() => {
    return [...allocations].sort((a, b) => {
      const aTime = new Date(a.assignedAt).getTime()
      const bTime = new Date(b.assignedAt).getTime()
      return bTime - aTime
    })
  }, [allocations])

  async function activateTechnicianSession() {
    const parsed = Number(technicianIdInput)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setJobsError("Enter a valid technician employee ID")
      return
    }
    window.localStorage.setItem(TECHNICIAN_STORAGE_KEY, String(parsed))
    setActiveTechnicianId(parsed)
    setJobsError(null)

    try {
      setTokenSaving(true)
      setTokenMessage(null)
      await registerTechnicianPushToken(parsed)
      window.localStorage.setItem(`${TECHNICIAN_PUSH_ENABLED_PREFIX}${parsed}`, "1")
      setNotificationsEnabled(true)
      setTokenMessage("Setup complete. Notifications enabled for this device.")
    } catch (error: any) {
      setNotificationsEnabled(false)
      setTokenMessage(error?.message || "Technician ID saved, but notifications are not enabled yet.")
    } finally {
      setTokenSaving(false)
    }
  }

  async function runAllocationAction(allocationId: string, action: "accept" | "start" | "complete") {
    setActionLoadingId(allocationId)
    setJobsError(null)
    try {
      let body: string | undefined
      if (action === "complete") {
        const entered = window.prompt("Enter earning amount (optional)")?.trim()
        if (entered) {
          const parsed = Number(entered)
          if (Number.isFinite(parsed)) {
            body = JSON.stringify({ earningAmount: parsed })
          }
        }
      }

      const response = await fetch(`/api/job/${allocationId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body ?? "{}",
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to ${action} job`)
      }

      if (activeTechnicianId) {
        await loadJobs(activeTechnicianId, showAllJobs)
      }
    } catch (error: any) {
      setJobsError(error?.message || `Failed to ${action} job`)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function enableNotifications() {
    if (!activeTechnicianId) {
      setTokenMessage("Load technician ID first")
      return
    }

    setTokenSaving(true)
    setTokenMessage(null)
    try {
      await registerTechnicianPushToken(activeTechnicianId)
      window.localStorage.setItem(`${TECHNICIAN_PUSH_ENABLED_PREFIX}${activeTechnicianId}`, "1")
      setNotificationsEnabled(true)
      setTokenMessage("Notifications enabled and device token saved successfully.")
    } catch (error: any) {
      setNotificationsEnabled(false)
      setTokenMessage(error?.message || "Failed to enable notifications")
    } finally {
      setTokenSaving(false)
    }
  }

  useEffect(() => {
    seenAllocationIdsRef.current = new Set()
    hasInitializedAllocationsRef.current = false
    setNewJobCount(0)
  }, [activeTechnicianId])

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        {!activeTechnicianId ? (
          <Card className="p-4">
            <h1 className="text-lg font-semibold">Technician Setup</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your employee ID once. This device will remember you and open the dashboard automatically from next time.
            </p>

            <div className="mt-3 flex gap-2">
              <Input
                value={technicianIdInput}
                onChange={(e) => setTechnicianIdInput(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Employee ID"
                inputMode="numeric"
              />
              <Button onClick={() => void activateTechnicianSession()} disabled={tokenSaving}>
                {tokenSaving ? "Setting up..." : "Complete Setup"}
              </Button>
            </div>

            {!isSecureContextClient ? (
              <p className="mt-2 text-xs text-red-600">HTTPS is required on mobile for push notifications.</p>
            ) : null}
            {tokenMessage ? <p className="mt-2 text-xs text-muted-foreground">{tokenMessage}</p> : null}
          </Card>
        ) : (
          <Card className="p-4">
            <h1 className="text-lg font-semibold">Technician Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stored technician ID: #{activeTechnicianId}. This device will keep you signed in.
            </p>
          </Card>
        )}

        {activeTechnicianId && !notificationsEnabled ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Push Notifications</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap once to allow notifications and auto-register this device.
          </p>
          <div className="mt-3 space-y-2">
            <Button onClick={enableNotifications} disabled={tokenSaving || !activeTechnicianId}>
              {tokenSaving ? "Enabling..." : "Enable Notifications"}
            </Button>
            {!isSecureContextClient ? (
              <p className="text-xs text-red-600">Push requires HTTPS (or localhost).</p>
            ) : null}
            {tokenMessage ? <p className="text-xs text-muted-foreground">{tokenMessage}</p> : null}
          </div>
        </Card>
        ) : null}

        {activeTechnicianId ? (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">My Jobs</h2>
            <Button variant="outline" size="sm" onClick={() => setShowAllJobs((prev) => !prev)}>
              {showAllJobs ? "Show Pending" : "Show All"}
            </Button>
          </div>

          {newJobCount > 0 ? (
            <div className="mt-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-sm font-medium text-amber-800">
                {newJobCount} new job{newJobCount > 1 ? "s" : ""} assigned
              </p>
              <button
                type="button"
                className="ml-4 text-xs text-amber-700 underline"
                onClick={() => setNewJobCount(0)}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {jobsError ? <p className="mt-3 text-sm text-red-600">{jobsError}</p> : null}

          {loadingJobs ? <p className="mt-3 text-sm text-muted-foreground">Loading jobs...</p> : null}

          {!loadingJobs && sortedAllocations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No jobs found.</p>
          ) : null}

          <div className="mt-3 space-y-3">
            {sortedAllocations.map((allocation) => {
              const registration = allocation.jobCard?.vehicle?.registrationNumber || "Vehicle"
              const makeModel = [allocation.jobCard?.vehicle?.make, allocation.jobCard?.vehicle?.model]
                .filter(Boolean)
                .join(" ")
              const isBusy = actionLoadingId === allocation.id

              return (
                <div key={allocation.id} className="rounded-md border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {registration}
                      {makeModel ? ` - ${makeModel}` : ""}
                    </p>
                    <span className={`rounded px-2 py-1 text-xs font-medium ${statusClassName(allocation.status)}`}>
                      {allocation.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">JobCard: {allocation.jobCard?.jobCardNumber || allocation.jobCard?.id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Task: {allocation.taskAssigned?.trim() || "-"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Assigned: {formatDateTime(allocation.assignedAt)}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {allocation.status === "assigned" ? (
                      <Button size="sm" disabled={isBusy} onClick={() => runAllocationAction(allocation.id, "accept")}>
                        {isBusy ? "Updating..." : "Accept"}
                      </Button>
                    ) : null}

                    {allocation.status === "accepted" ? (
                      <Button size="sm" disabled={isBusy} onClick={() => runAllocationAction(allocation.id, "start")}>
                        {isBusy ? "Updating..." : "Start"}
                      </Button>
                    ) : null}

                    {allocation.status === "in_progress" ? (
                      <Button size="sm" disabled={isBusy} onClick={() => runAllocationAction(allocation.id, "complete")}>
                        {isBusy ? "Updating..." : "Complete"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
        ) : null}
      </div>
    </main>
  )
}

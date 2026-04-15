"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/notify"

type LeaveRequestItem = {
  id: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  status: string
  requestedAt: string
  employee: {
    employeeId: number
    empName: string
    mobile: string
  }
  leaveType: {
    leaveName: string
    leaveCode: string
    paidPercentage: number
  }
}

export function AdminLeaveRequestsPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [requests, setRequests] = useState<LeaveRequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leave-requests?status=${statusFilter}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch leave requests")
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to fetch leave requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRequests()
  }, [statusFilter])

  const takeAction = async (id: string, action: "approve" | "reject") => {
    setActingId(id)
    try {
      const res = await fetch(`/api/leave-requests/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to ${action} request`)
      toast.success(`Leave request ${action}d`)
      await fetchRequests()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : `Failed to ${action} request`)
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-800">Leave Requests</h3>
        <div className="w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-500">No leave requests found.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => (
            <div key={item.id} className="rounded-lg border bg-white p-4 text-sm space-y-1">
              <div className="font-semibold text-slate-900">{item.employee?.empName || "Employee"}</div>
              <div>
                {item.leaveType?.leaveName} ({item.leaveType?.leaveCode}) • Paid {item.leaveType?.paidPercentage}%
              </div>
              <div>
                 {new Date(item.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })} - {new Date(item.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                {" "}({item.totalDays} days)
              </div>
              <div>Reason: {item.reason}</div>
              <div>Status: <span className="font-medium uppercase">{item.status}</span></div>

              {item.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => takeAction(item.id, "approve")}
                    disabled={actingId === item.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => takeAction(item.id, "reject")}
                    disabled={actingId === item.id}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

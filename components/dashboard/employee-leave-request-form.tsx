"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import DatePickerInput from "@/components/ui/date-picker-input"
import { toast } from "@/components/ui/notify"

type LeaveType = {
  id: string
  leaveName: string
  leaveCode: string
  maxDaysPerYear: number
  paidPercentage: number
}

type LeaveBalance = {
  id: string
  totalDays: number
  usedDays: number
  remainingDays: number
  leaveType: LeaveType
}

type LeaveRequestItem = {
  id: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  status: string
  requestedAt: string
  leaveType: LeaveType
}

interface EmployeeLeaveRequestFormProps {
  employeeId?: number | null
}

export function EmployeeLeaveRequestForm({ employeeId }: EmployeeLeaveRequestFormProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [leaveTypeId, setLeaveTypeId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((item) => item.id === leaveTypeId) || null,
    [leaveTypes, leaveTypeId]
  )

  const fetchData = async () => {
    setLoading(true)
    try {
      const [typesRes, balanceRes, requestRes] = await Promise.all([
        fetch("/api/leave-types", { cache: "no-store" }),
        fetch(`/api/leave-balance${employeeId ? `?employeeId=${employeeId}` : ""}`, { cache: "no-store" }),
        fetch(`/api/leave-requests${employeeId ? `?employeeId=${employeeId}` : ""}`, { cache: "no-store" }),
      ])

      const [typesData, balanceData, requestData] = await Promise.all([
        typesRes.json(),
        balanceRes.json(),
        requestRes.json(),
      ])

      if (!typesRes.ok) throw new Error(typesData.error || "Failed to load leave types")
      if (!balanceRes.ok) throw new Error(balanceData.error || "Failed to load leave balance")
      if (!requestRes.ok) throw new Error(requestData.error || "Failed to load leave requests")

      setLeaveTypes(Array.isArray(typesData) ? typesData : [])
      setBalances(Array.isArray(balanceData.balances) ? balanceData.balances : [])
      setRequests(Array.isArray(requestData.requests) ? requestData.requests : [])
      if (!leaveTypeId && Array.isArray(typesData) && typesData.length > 0) {
        setLeaveTypeId(typesData[0].id)
      }
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to load leave data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [employeeId])

  const submitRequest = async () => {
    if (!leaveTypeId || !startDate || !endDate || !reason.trim()) {
      toast.error("Please fill all leave request fields")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit leave request")

      toast.success("Leave request submitted")
      setReason("")
      await fetchData()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to submit leave request")
    } finally {
      setSaving(false)
    }
  }

  const selectedBalance = balances.find((item) => item.leaveType.id === leaveTypeId)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <h3 className="text-base font-semibold text-slate-800">Request Leave</h3>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Leave Type</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
              <SelectContent>
                {leaveTypes.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.leaveName} ({item.leaveCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-slate-600 rounded border bg-slate-50 p-2">
            <div>Code: <span className="font-medium">{selectedLeaveType?.leaveCode || "-"}</span></div>
            <div>Paid: <span className="font-medium">{selectedLeaveType?.paidPercentage ?? 0}%</span></div>
            <div>Remaining: <span className="font-medium">{selectedBalance?.remainingDays ?? 0}</span> days</div>
          </div>

          <div>
            <Label>Start Date</Label>
            <DatePickerInput value={startDate} onChange={setStartDate} format="iso" popoverSide="bottom" />
          </div>

          <div>
            <Label>End Date</Label>
            <DatePickerInput value={endDate} onChange={setEndDate} format="iso" popoverSide="bottom" />
          </div>

          <div className="md:col-span-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave" />
          </div>
        </div>

        <Button type="button" onClick={submitRequest} disabled={saving || loading}>
          {saving ? "Submitting..." : "Submit Request"}
        </Button>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-2">
        <h3 className="text-base font-semibold text-slate-800">Leave Balances</h3>
        {balances.length === 0 ? (
          <div className="text-sm text-slate-500">No leave balances available.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {balances.map((balance) => (
              <div key={balance.id} className="rounded border p-2 text-sm">
                <div className="font-medium">{balance.leaveType.leaveName}</div>
                <div>Total: {Number(balance.totalDays || 0)}</div>
                <div>Used: {Number(balance.usedDays || 0)}</div>
                <div>Remaining: {Number(balance.remainingDays || 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-2">
        <h3 className="text-base font-semibold text-slate-800">My Leave Requests</h3>
        {requests.length === 0 ? (
          <div className="text-sm text-slate-500">No leave requests found.</div>
        ) : (
          <div className="space-y-2">
            {requests.map((item) => (
              <div key={item.id} className="rounded border p-2 text-sm">
                <div className="font-medium">
                  {item.leaveType?.leaveName || "Leave"} ({item.leaveType?.leaveCode || "-"})
                </div>
                <div>
                  {new Date(item.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })} - {new Date(item.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  {" "}({item.totalDays} days)
                </div>
                <div>Status: <span className="font-medium uppercase">{item.status}</span></div>
                <div className="text-slate-600">{item.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

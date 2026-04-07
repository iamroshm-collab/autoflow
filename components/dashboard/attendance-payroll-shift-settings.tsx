"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/notify"

export default function ShiftSettingsDialog({ employeeId, open, onOpenChange }: { employeeId?: number | null, open: boolean, onOpenChange: (v: boolean) => void }) {
  const [shiftStart, setShiftStart] = useState("09:00")
  const [shiftEnd, setShiftEnd] = useState("18:00")
  const [grace, setGrace] = useState(10)
  const [overtime, setOvertime] = useState(30)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && employeeId) fetchShift()
  }, [open, employeeId])

  const fetchShift = async () => {
    if (!employeeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance-payroll/shifts?employeeId=${employeeId}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      if (data) {
        setShiftStart(data.shiftStart || "09:00")
        setShiftEnd(data.shiftEnd || "18:00")
        setGrace(data.gracePeriodMins ?? 10)
        setOvertime(data.overtimeThresholdMins ?? 30)
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to load shift")
    } finally { setLoading(false) }
  }

  const saveShift = async () => {
    if (!employeeId) {
      toast.error("Select an employee to set shift")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance-payroll/shifts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId, shiftStart, shiftEnd, gracePeriodMins: grace, overtimeThresholdMins: overtime }) })
      if (!res.ok) throw new Error("Failed")
      toast.success("Shift saved")
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error("Failed to save")
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Shift Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Shift Start</Label>
            <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
          </div>
          <div>
            <Label>Shift End</Label>
            <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
          </div>
          <div>
            <Label>Grace Period (mins)</Label>
            <Input type="number" value={String(grace)} onChange={(e) => setGrace(Number(e.target.value))} />
          </div>
          <div>
            <Label>Overtime Threshold (mins)</Label>
            <Input type="number" value={String(overtime)} onChange={(e) => setOvertime(Number(e.target.value))} />
          </div>

          <div className="flex gap-2">
            <Button onClick={saveShift} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

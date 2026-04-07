"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/notify"

export default function HolidaysDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (v: boolean) => void }) {
  const [holidays, setHolidays] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [date, setDate] = useState("")

  useEffect(() => { if (open) fetchHolidays() }, [open])

  const fetchHolidays = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/attendance-payroll/holidays")
      if (!res.ok) throw new Error("Failed to fetch holidays")
      const data = await res.json()
      setHolidays(data)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load holidays")
    } finally { setLoading(false) }
  }

  const addHoliday = async () => {
    if (!date || !name) {
      toast.error("Date and name required")
      return
    }
    try {
      const res = await fetch("/api/attendance-payroll/holidays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, name, description: "" }) })
      if (!res.ok) throw new Error("Failed")
      toast.success("Holiday added")
      setName("")
      setDate("")
      fetchHolidays()
    } catch (err) {
      console.error(err)
      toast.error("Failed to add holiday")
    }
  }

  const removeHoliday = async (id: number) => {
    if (!confirm("Delete holiday?")) return
    try {
      const res = await fetch(`/api/attendance-payroll/holidays/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast.success("Deleted")
      fetchHolidays()
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Holidays</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={addHoliday}>Add</Button>
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-2">Existing holidays</div>
            <div className="space-y-2">
              {loading ? <div>Loading...</div> : holidays.map((h) => (
                <div key={h.id} className="flex justify-between items-center border rounded p-2">
                  <div>
                    <div className="font-medium">{h.name}</div>
                    <div className="text-sm text-gray-500">{h.date}</div>
                  </div>
                  <div>
                    <Button variant="destructive" onClick={() => removeHoliday(h.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

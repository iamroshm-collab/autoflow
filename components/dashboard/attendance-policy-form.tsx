"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import DatePickerInput from "@/components/ui/date-picker-input"
import { toast } from "@/components/ui/notify"
import { Plus, Trash2 } from "lucide-react"

type DurationOperator = "lt" | "gt" | "eq" | "lte" | "gte" | "between"

interface AttendancePolicyConfig {
  company_id: string
  holiday_rules: {
    sunday_auto_holiday: boolean
    holidays: Array<{
      holiday_date: string
      holiday_name: string
      holiday_type: string
    }>
  }
  attendance_rules: Array<{
    id: string
    operator: DurationOperator
    duration_minutes?: number
    min_minutes?: number
    max_minutes?: number
    payable_percentage: number
  }>
  overtime_rules: {
    overtime_start_duration_minutes: number
    tiers: Array<{
      id: string
      after_minutes: number
      multiplier: number
    }>
  }
  leave_types: Array<{
    id: string
    leave_name: string
    paid_percentage: number
    requires_approval: boolean
    deduct_from_balance: boolean
  }>
  leave_rules: {
    grant_compensatory_leave_on_holiday_work: boolean
    overtime_compensation_mode: "payment_or_comp_off" | "payment_only" | "comp_off_only"
  }
  work_duration_settings: {
    standard_work_hours: number
    break_duration_minutes: number
    maximum_work_hours: number
  }
  processing_logic: string[]
}

interface AttendancePolicyFormProps {
  isAdminViewer?: boolean
}

const DEFAULT_POLICY: AttendancePolicyConfig = {
  company_id: "default",
  holiday_rules: {
    sunday_auto_holiday: true,
    holidays: [],
  },
  attendance_rules: [
    { id: "present-rule", operator: "gte", duration_minutes: 480, payable_percentage: 100 },
    { id: "halfday-rule", operator: "between", min_minutes: 240, max_minutes: 479, payable_percentage: 50 },
    { id: "absent-rule", operator: "lt", duration_minutes: 240, payable_percentage: 0 },
  ],
  overtime_rules: {
    overtime_start_duration_minutes: 480,
    tiers: [
      { id: "ot-1", after_minutes: 480, multiplier: 1.5 },
      { id: "ot-2", after_minutes: 600, multiplier: 2 },
    ],
  },
  leave_types: [
    { id: "leave-1", leave_name: "Annual Leave", paid_percentage: 100, requires_approval: true, deduct_from_balance: true },
    { id: "leave-2", leave_name: "Medical Leave", paid_percentage: 100, requires_approval: true, deduct_from_balance: true },
    { id: "leave-3", leave_name: "Half Pay Leave", paid_percentage: 50, requires_approval: true, deduct_from_balance: true },
    { id: "leave-4", leave_name: "Compensatory Leave", paid_percentage: 100, requires_approval: true, deduct_from_balance: true },
    { id: "leave-5", leave_name: "Casual Leave", paid_percentage: 100, requires_approval: true, deduct_from_balance: true },
    { id: "leave-6", leave_name: "Unpaid Leave", paid_percentage: 0, requires_approval: true, deduct_from_balance: false },
  ],
  leave_rules: {
    grant_compensatory_leave_on_holiday_work: true,
    overtime_compensation_mode: "payment_or_comp_off",
  },
  work_duration_settings: {
    standard_work_hours: 8,
    break_duration_minutes: 60,
    maximum_work_hours: 12,
  },
  processing_logic: [
    "Check holiday calendar",
    "Check approved leave",
    "Calculate work duration",
    "Apply attendance rules",
    "Apply overtime rules",
    "Apply leave rules",
  ],
}

const OPERATORS: Array<{ value: DurationOperator; label: string }> = [
  { value: "lt", label: "Less than" },
  { value: "gt", label: "Greater than" },
  { value: "eq", label: "Equal" },
  { value: "lte", label: "Less than or equal" },
  { value: "gte", label: "Greater than or equal" },
  { value: "between", label: "Between (range)" },
]

const HOLIDAY_TYPES = ["public", "festival", "company", "regional"]
const OVERTIME_MULTIPLIERS = [0.125, 0.25, 0.5, 1, 1.25, 1.5, 2]
const WIDE_SWITCH_CLASS = "data-[state=checked]:!bg-blue-600 data-[state=unchecked]:!bg-slate-300"
const DELETE_ICON_BUTTON_CLASS = "text-red-600 hover:bg-red-50 hover:text-red-700"

const getMonthCells = (month: number, year: number) => {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<{ date: string | null; day: number | null; isSunday: boolean }> = []

  for (let i = 0; i < firstDow; i += 1) {
    cells.push({ date: null, day: null, isSunday: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const isSunday = new Date(year, month - 1, day).getDay() === 0
    cells.push({ date, day, isSunday })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, isSunday: false })
  }

  return cells
}

export function AttendancePolicyForm({ isAdminViewer = true }: AttendancePolicyFormProps) {
  const now = new Date()
  const [policy, setPolicy] = useState<AttendancePolicyConfig>(DEFAULT_POLICY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [editingHoliday, setEditingHoliday] = useState<{
    date: string
    step: "type" | "name"
    rect?: { top: number; left: number; width: number; bottom: number }
  } | null>(null)
  const portalRoot = useRef<Element | null>(null)
  useEffect(() => { portalRoot.current = document.body }, [])

  const [holidayMonth, setHolidayMonth] = useState(now.getMonth() + 1)
  const [holidayYear, setHolidayYear] = useState(now.getFullYear())
  const closeHolidayEdit = () => setEditingHoliday(null)

  useEffect(() => {
    if (!editingHoliday || editingHoliday.step !== "type") return
    const handler = (e: MouseEvent) => {
      const portal = document.getElementById("holiday-type-portal")
      if (portal && portal.contains(e.target as Node)) return
      setEditingHoliday(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [editingHoliday])

  const [previewDate, setPreviewDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`)
  const [previewCheckIn, setPreviewCheckIn] = useState("")
  const [previewCheckOut, setPreviewCheckOut] = useState("")
  const [previewApprovedLeave, setPreviewApprovedLeave] = useState(false)
  const [previewResult, setPreviewResult] = useState<any | null>(null)

  const monthCells = useMemo(() => getMonthCells(holidayMonth, holidayYear), [holidayMonth, holidayYear])

  const holidayByDate = useMemo(() => {
    const map = new Map<string, { holiday_date: string; holiday_name: string; holiday_type: string }>()
    policy.holiday_rules.holidays.forEach((holiday) => map.set(holiday.holiday_date, holiday))
    return map
  }, [policy.holiday_rules.holidays])

  const fetchPolicy = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/attendance-policy", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to fetch policy")
      setPolicy({ ...DEFAULT_POLICY, ...data })
    } catch (error) {
      console.error(error)
      toast.error("Failed to load attendance policy")
    } finally {
      setLoading(false)
    }
  }

  const fetchAudit = async () => {
    try {
      const response = await fetch("/api/attendance-policy/audit", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to fetch audit")
      setAuditLogs(Array.isArray(data) ? data : [])
    } catch {
      setAuditLogs([])
    }
  }

  useEffect(() => {
    void fetchPolicy()
    if (isAdminViewer) {
      void fetchAudit()
    }
  }, [isAdminViewer])

  const updatePolicy = (updater: (draft: AttendancePolicyConfig) => AttendancePolicyConfig) => {
    setPolicy((prev) => updater(prev))
  }

  const toggleHolidayDate = (date: string) => {
    updatePolicy((prev) => {
      const exists = prev.holiday_rules.holidays.some((holiday) => holiday.holiday_date === date)
      if (exists) {
        return {
          ...prev,
          holiday_rules: {
            ...prev.holiday_rules,
            holidays: prev.holiday_rules.holidays.filter((holiday) => holiday.holiday_date !== date),
          },
        }
      }
      return {
        ...prev,
        holiday_rules: {
          ...prev.holiday_rules,
          holidays: [
            ...prev.holiday_rules.holidays,
            { holiday_date: date, holiday_name: "Holiday", holiday_type: "public" },
          ],
        },
      }
    })
  }

  const updateHolidayField = (date: string, key: "holiday_name" | "holiday_type", value: string) => {
    updatePolicy((prev) => ({
      ...prev,
      holiday_rules: {
        ...prev.holiday_rules,
        holidays: prev.holiday_rules.holidays.map((holiday) =>
          holiday.holiday_date === date ? { ...holiday, [key]: value } : holiday
        ),
      },
    }))
  }

  const savePolicy = async () => {
    if (!isAdminViewer) {
      toast.error("Only admin/manager can update policy")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/attendance-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save attendance policy")
      setPolicy({ ...DEFAULT_POLICY, ...data.policy })
      toast.success("Attendance policy saved")
      void fetchAudit()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to save attendance policy")
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async () => {
    if (!previewCheckIn || !previewCheckOut) {
      toast.error("Please select check-in and check-out time")
      return
    }

    try {
      const response = await fetch("/api/attendance-policy/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_in_time: previewCheckIn,
          check_out_time: previewCheckOut,
          date: previewDate,
          has_approved_leave: previewApprovedLeave,
          policy,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to run preview")
      setPreviewResult(data)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to run preview")
    }
  }

  return (
    <div className="space-y-4" style={{ paddingTop: "var(--master-gap)" }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-800">Attendance Policy Form</h3>
        <Button onClick={savePolicy} disabled={!isAdminViewer || saving || loading}>
          {saving ? "Saving..." : "Save Policy"}
        </Button>
      </div>

      <Accordion type="multiple" className="w-full rounded-lg border bg-white px-4">
        <AccordionItem value="holiday-calendar">
          <AccordionTrigger>Holiday Calendar</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Label>Sunday Auto-Holiday</Label>
                <Switch
                  checked={policy.holiday_rules.sunday_auto_holiday}
                  onCheckedChange={(checked) =>
                    updatePolicy((prev) => ({
                      ...prev,
                      holiday_rules: { ...prev.holiday_rules, sunday_auto_holiday: checked },
                    }))
                  }
                  size="sm"
                  className={WIDE_SWITCH_CLASS}
                  disabled={!isAdminViewer}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(holidayMonth)} onValueChange={(value) => { setHolidayMonth(Number(value)); closeHolidayEdit() }}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <SelectItem key={month} value={String(month)}>
                        {new Date(2000, month - 1, 1).toLocaleString("en-IN", { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(holidayYear)} onValueChange={(value) => { setHolidayYear(Number(value)); closeHolidayEdit() }}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 8 }, (_, index) => now.getFullYear() - 2 + index).map((year) => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border">
                <div className="grid grid-cols-7 bg-slate-100 text-center text-xs font-semibold text-slate-600 rounded-t-lg overflow-hidden">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="py-2">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 divide-x divide-y border-t">
                  {monthCells.map((cell, idx) => {
                    if (!cell.date || !cell.day) {
                      return <div key={`blank-${idx}`} className="h-24 bg-slate-50" />
                    }

                    const holiday = holidayByDate.get(cell.date)
                    const isHoliday = Boolean(holiday)
                    const isSundayAuto = policy.holiday_rules.sunday_auto_holiday && cell.isSunday
                    const editStep = editingHoliday?.date === cell.date ? editingHoliday.step : null
                    const bgClass = isSundayAuto ? "bg-red-50" : isHoliday ? "bg-amber-50" : "bg-white"

                    return (
                      <div
                        key={cell.date}
                        className={`h-24 p-1.5 text-xs flex flex-col gap-1 relative min-w-0 ${bgClass} ${isAdminViewer ? "cursor-pointer" : ""}`}
                        onClick={(e) => {
                          if (!isAdminViewer) return
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          const rect = { top: r.top, left: r.left, width: r.width, bottom: r.bottom }
                          if (isHoliday) {
                            if (editStep) {
                              setEditingHoliday(null)
                            } else {
                              setEditingHoliday({ date: cell.date, step: "type", rect })
                            }
                          } else {
                            toggleHolidayDate(cell.date)
                            setEditingHoliday({ date: cell.date, step: "type", rect })
                          }
                        }}
                      >
                        <span className={`font-bold ${isSundayAuto ? "text-red-500" : isHoliday ? "text-amber-600" : "text-slate-700"}`}>{cell.day}</span>

                        {/* Default display — not editing */}
                        {isHoliday && !editStep && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-amber-700 leading-tight truncate">{holiday?.holiday_name || "Holiday"}</span>
                            <span className="text-[9px] text-amber-500 leading-tight capitalize">{holiday?.holiday_type || "public"}</span>
                          </div>
                        )}

                        {/* Step 1: rendered via portal — see portal block below the grid */}

                        {/* Step 2: enter holiday name */}
                        {isHoliday && editStep === "name" && (
                          <div className="flex flex-col gap-1 mt-0.5">
                            <span className="text-[9px] text-amber-500 capitalize">{holiday?.holiday_type || "public"}</span>
                            <Input
                              autoFocus
                              value={holiday?.holiday_name || ""}
                              placeholder="Holiday name"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateHolidayField(cell.date!, "holiday_name", e.target.value)}
                              className="h-7 text-[10px] border-amber-400 ring-1 ring-amber-300 bg-white"
                              disabled={!isAdminViewer}
                            />
                          </div>
                        )}

                        {!isHoliday && !isSundayAuto && (
                          <span className="text-[10px] text-slate-400">Click to mark holiday</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Portal: holiday type dropdown — floats over everything */}
            {editingHoliday?.step === "type" && editingHoliday.rect && portalRoot.current && createPortal(
              <div
                id="holiday-type-portal"
                className="dropdown-scroll"
                style={{
                  position: "fixed",
                  top: editingHoliday.rect.bottom + 2,
                  left: editingHoliday.rect.left,
                  width: Math.max(editingHoliday.rect.width, 120),
                  zIndex: 9999,
                }}
              >
                {HOLIDAY_TYPES.map((type) => {
                  const h = holidayByDate.get(editingHoliday.date)
                  return (
                    <button
                      key={type}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation()
                        updateHolidayField(editingHoliday.date, "holiday_type", type)
                        setEditingHoliday({ ...editingHoliday, step: "name" })
                      }}
                      className={`dropdown-item capitalize text-xs${(h?.holiday_type || "public") === type ? " selected" : ""}`}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>,
              portalRoot.current
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="attendance-rules">
          <AccordionTrigger>Attendance Rules</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {policy.attendance_rules.map((rule, index) => (
                <div key={rule.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-6">
                  <Select
                    value={rule.operator}
                    onValueChange={(value) =>
                      updatePolicy((prev) => ({
                        ...prev,
                        attendance_rules: prev.attendance_rules.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, operator: value as DurationOperator } : item
                        ),
                      }))
                    }
                    disabled={!isAdminViewer}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((operator) => (
                        <SelectItem key={operator.value} value={operator.value}>{operator.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {rule.operator === "between" ? (
                    <>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={String(rule.min_minutes ?? "")}
                          onChange={(e) =>
                            updatePolicy((prev) => ({
                              ...prev,
                              attendance_rules: prev.attendance_rules.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, min_minutes: Number(e.target.value || 0) } : item
                              ),
                            }))
                          }
                          disabled={!isAdminViewer}
                          className="pr-12"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">mins</span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="Max"
                          value={String(rule.max_minutes ?? "")}
                          onChange={(e) =>
                            updatePolicy((prev) => ({
                              ...prev,
                              attendance_rules: prev.attendance_rules.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, max_minutes: Number(e.target.value || 0) } : item
                              ),
                            }))
                          }
                          disabled={!isAdminViewer}
                          className="pr-12"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">mins</span>
                      </div>
                    </>
                  ) : (
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="Duration"
                        value={String(rule.duration_minutes ?? "")}
                        onChange={(e) =>
                          updatePolicy((prev) => ({
                            ...prev,
                            attendance_rules: prev.attendance_rules.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, duration_minutes: Number(e.target.value || 0) } : item
                            ),
                          }))
                        }
                        disabled={!isAdminViewer}
                        className="pr-12"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">mins</span>
                    </div>
                  )}

                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Payable %"
                      value={String(rule.payable_percentage ?? 0)}
                      onChange={(e) =>
                        updatePolicy((prev) => ({
                          ...prev,
                          attendance_rules: prev.attendance_rules.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  payable_percentage: Math.min(100, Math.max(0, Number(e.target.value || 0))),
                                }
                              : item
                          ),
                        }))
                      }
                      disabled={!isAdminViewer}
                      className="pr-8"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                  </div>

                  <div className="flex justify-end md:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updatePolicy((prev) => ({
                          ...prev,
                          attendance_rules: prev.attendance_rules.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                      disabled={!isAdminViewer || policy.attendance_rules.length <= 1}
                      className={DELETE_ICON_BUTTON_CLASS}
                      aria-label="Remove attendance rule"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  updatePolicy((prev) => ({
                    ...prev,
                    attendance_rules: [
                      ...prev.attendance_rules,
                      { id: `rule-${Date.now()}`, operator: "gte", duration_minutes: 0, payable_percentage: 100 },
                    ],
                  }))
                }
                disabled={!isAdminViewer}
              >
                <Plus className="mr-1 h-4 w-4" /> Add Rule
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="overtime-rules">
          <AccordionTrigger>Overtime Rules</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label>Overtime Start Duration (minutes)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={String(policy.overtime_rules.overtime_start_duration_minutes)}
                      onChange={(e) =>
                        updatePolicy((prev) => ({
                          ...prev,
                          overtime_rules: {
                            ...prev.overtime_rules,
                            overtime_start_duration_minutes: Number(e.target.value || 0),
                          },
                        }))
                      }
                      disabled={!isAdminViewer}
                      className="pr-12"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">mins</span>
                  </div>
                </div>
              </div>

              {policy.overtime_rules.tiers.map((tier, index) => (
                <div key={tier.id} className="grid gap-2 rounded border p-2 md:grid-cols-4">
                  <div className="relative">
                    <Input
                      type="number"
                      value={String(tier.after_minutes)}
                      onChange={(e) =>
                        updatePolicy((prev) => ({
                          ...prev,
                          overtime_rules: {
                            ...prev.overtime_rules,
                            tiers: prev.overtime_rules.tiers.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, after_minutes: Number(e.target.value || 0) } : item
                            ),
                          },
                        }))
                      }
                      disabled={!isAdminViewer}
                      className="pr-12"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">mins</span>
                  </div>
                  <Select
                    value={String(tier.multiplier)}
                    onValueChange={(value) =>
                      updatePolicy((prev) => ({
                        ...prev,
                        overtime_rules: {
                          ...prev.overtime_rules,
                          tiers: prev.overtime_rules.tiers.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, multiplier: Number(value) } : item
                          ),
                        },
                      }))
                    }
                    disabled={!isAdminViewer}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OVERTIME_MULTIPLIERS.map((multiplier) => (
                        <SelectItem key={multiplier} value={String(multiplier)}>{multiplier}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updatePolicy((prev) => ({
                          ...prev,
                          overtime_rules: {
                            ...prev.overtime_rules,
                            tiers: prev.overtime_rules.tiers.filter((_, itemIndex) => itemIndex !== index),
                          },
                        }))
                      }
                      disabled={!isAdminViewer || policy.overtime_rules.tiers.length <= 1}
                      className={DELETE_ICON_BUTTON_CLASS}
                      aria-label="Remove overtime tier"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                disabled={!isAdminViewer}
                onClick={() =>
                  updatePolicy((prev) => ({
                    ...prev,
                    overtime_rules: {
                      ...prev.overtime_rules,
                      tiers: [
                        ...prev.overtime_rules.tiers,
                        { id: `tier-${Date.now()}`, after_minutes: prev.overtime_rules.overtime_start_duration_minutes, multiplier: 1.25 },
                      ],
                    },
                  }))
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add Overtime Tier
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="leave-types">
          <AccordionTrigger>Leave Types</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {policy.leave_types.map((leaveType, index) => (
                <div key={leaveType.id} className="grid gap-2 rounded border p-2 md:grid-cols-6">
                  <Input
                    value={leaveType.leave_name}
                    onChange={(e) =>
                      updatePolicy((prev) => ({
                        ...prev,
                        leave_types: prev.leave_types.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, leave_name: e.target.value } : item
                        ),
                      }))
                    }
                    disabled={!isAdminViewer}
                  />
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={String(leaveType.paid_percentage)}
                      onChange={(e) =>
                        updatePolicy((prev) => ({
                          ...prev,
                          leave_types: prev.leave_types.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, paid_percentage: Math.min(100, Math.max(0, Number(e.target.value || 0))) }
                              : item
                          ),
                        }))
                      }
                      disabled={!isAdminViewer}
                      className="pr-8"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Requires approval</Label>
                    <Switch
                      checked={leaveType.requires_approval}
                      onCheckedChange={(checked) =>
                        updatePolicy((prev) => ({
                          ...prev,
                          leave_types: prev.leave_types.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, requires_approval: checked } : item
                          ),
                        }))
                      }
                      size="sm"
                  className={WIDE_SWITCH_CLASS}
                      disabled={!isAdminViewer}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Deduct balance</Label>
                    <Switch
                      checked={leaveType.deduct_from_balance}
                      onCheckedChange={(checked) =>
                        updatePolicy((prev) => ({
                          ...prev,
                          leave_types: prev.leave_types.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, deduct_from_balance: checked } : item
                          ),
                        }))
                      }
                      size="sm"
                  className={WIDE_SWITCH_CLASS}
                      disabled={!isAdminViewer}
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updatePolicy((prev) => ({
                          ...prev,
                          leave_types: prev.leave_types.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                      disabled={!isAdminViewer || policy.leave_types.length <= 1}
                      className={DELETE_ICON_BUTTON_CLASS}
                      aria-label="Remove leave type"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                disabled={!isAdminViewer}
                onClick={() =>
                  updatePolicy((prev) => ({
                    ...prev,
                    leave_types: [
                      ...prev.leave_types,
                      {
                        id: `leave-${Date.now()}`,
                        leave_name: "Custom Leave",
                        paid_percentage: 100,
                        requires_approval: true,
                        deduct_from_balance: true,
                      },
                    ],
                  }))
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add Leave Type
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="work-duration-settings">
          <AccordionTrigger>Work Duration Settings</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <Label>Standard Work Hours</Label>
                <Input
                  type="number"
                  value={String(policy.work_duration_settings.standard_work_hours)}
                  onChange={(e) =>
                    updatePolicy((prev) => ({
                      ...prev,
                      work_duration_settings: {
                        ...prev.work_duration_settings,
                        standard_work_hours: Number(e.target.value || 0),
                      },
                    }))
                  }
                  disabled={!isAdminViewer}
                />
              </div>
              <div>
                <Label>Break Duration (minutes)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={String(policy.work_duration_settings.break_duration_minutes)}
                    onChange={(e) =>
                      updatePolicy((prev) => ({
                        ...prev,
                        work_duration_settings: {
                          ...prev.work_duration_settings,
                          break_duration_minutes: Number(e.target.value || 0),
                        },
                      }))
                    }
                    disabled={!isAdminViewer}
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">mins</span>
                </div>
              </div>
              <div>
                <Label>Maximum Work Hours</Label>
                <Input
                  type="number"
                  value={String(policy.work_duration_settings.maximum_work_hours)}
                  onChange={(e) =>
                    updatePolicy((prev) => ({
                      ...prev,
                      work_duration_settings: {
                        ...prev.work_duration_settings,
                        maximum_work_hours: Number(e.target.value || 0),
                      },
                    }))
                  }
                  disabled={!isAdminViewer}
                />
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <Label className="font-medium">Leave Calculation Rules</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={policy.leave_rules.grant_compensatory_leave_on_holiday_work}
                  onCheckedChange={(checked) =>
                    updatePolicy((prev) => ({
                      ...prev,
                      leave_rules: {
                        ...prev.leave_rules,
                        grant_compensatory_leave_on_holiday_work: checked,
                      },
                    }))
                  }
                  size="sm"
                  className={WIDE_SWITCH_CLASS}
                  disabled={!isAdminViewer}
                />
                <span className="text-sm">Grant compensatory leave when employee works on holiday</span>
              </div>
              <div className="max-w-xs">
                <Label>Overtime compensation mode</Label>
                <Select
                  value={policy.leave_rules.overtime_compensation_mode}
                  onValueChange={(value) =>
                    updatePolicy((prev) => ({
                      ...prev,
                      leave_rules: {
                        ...prev.leave_rules,
                        overtime_compensation_mode: value as AttendancePolicyConfig["leave_rules"]["overtime_compensation_mode"],
                      },
                    }))
                  }
                  disabled={!isAdminViewer}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment_or_comp_off">Overtime payment OR compensatory leave</SelectItem>
                    <SelectItem value="payment_only">Overtime payment only</SelectItem>
                    <SelectItem value="comp_off_only">Compensatory leave only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 rounded border bg-slate-50 p-3 text-sm text-slate-700">
              <p className="mb-2 font-medium">Attendance Processing Logic</p>
              <ol className="list-decimal pl-5">
                {policy.processing_logic.map((step, index) => (
                  <li key={`${step}-${index}`}>{step}</li>
                ))}
              </ol>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="policy-preview">
          <AccordionTrigger>Policy Preview</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Date</Label>
                <DatePickerInput value={previewDate} onChange={setPreviewDate} format="iso" popoverSide="bottom" />
              </div>
              <div className="flex items-center gap-2 self-end">
                <Switch
                  checked={previewApprovedLeave}
                  onCheckedChange={setPreviewApprovedLeave}
                  size="sm"
                  className={WIDE_SWITCH_CLASS}
                />
                <span className="text-sm">Approved leave</span>
              </div>
              <div>
                <Label>Check-in Time</Label>
                <Input type="datetime-local" value={previewCheckIn} onChange={(e) => setPreviewCheckIn(e.target.value)} />
              </div>
              <div>
                <Label>Check-out Time</Label>
                <Input type="datetime-local" value={previewCheckOut} onChange={(e) => setPreviewCheckOut(e.target.value)} />
              </div>
            </div>

            <div className="mt-3">
              <Button type="button" onClick={runPreview}>Run Preview</Button>
            </div>

            {previewResult && (
              <div className="mt-3 rounded border bg-slate-50 p-3 text-sm">
                <div>Payable Percentage: <span className="font-medium">{Number(previewResult.attendancePercentage || 0).toFixed(2)}%</span></div>
                <div>Overtime Hours: <span className="font-medium">{Number(previewResult.overtimeHours || 0).toFixed(2)}</span></div>
                <div>Overtime Multiplier: <span className="font-medium">{previewResult.overtimeMultiplier}x</span></div>
                <div>Leave Deduction: <span className="font-medium">{previewResult.leaveDeduction}</span></div>
                <div>Compensatory Leave Granted: <span className="font-medium">{previewResult.compOffGranted ? "Yes" : "No"}</span></div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="audit-log">
          <AccordionTrigger>Policy Audit Log</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {auditLogs.length === 0 && <div className="text-sm text-slate-500">No policy updates yet.</div>}
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded border p-2 text-xs">
                  <div className="font-medium">{log.changedBy}</div>
                  <div className="text-slate-500">{new Date(log.timestamp).toLocaleString("en-IN")}</div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

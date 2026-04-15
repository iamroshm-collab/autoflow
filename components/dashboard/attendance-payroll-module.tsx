"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from '@/components/ui/notify'
import { Printer, Plus, Trash2, Calendar, Edit3, CreditCard, Pencil, Save, X, RefreshCcw, ChevronDown, Check } from "lucide-react"
import { generateSalarySlipPdf } from "@/lib/salary-slip-pdf"
import { DatePickerInput } from "@/components/ui/date-picker-input"
import { AttendanceCaptureOverlay } from "@/components/dashboard/attendance-capture-overlay"
import { AttendancePolicyForm } from "@/components/dashboard/attendance-policy-form"
import { formatDateDDMMYY, getTodayISODateInIndia } from "@/lib/utils"

interface Employee {
  employeeId: number
  empName: string
  idNumber: string
  designation: string | null
  salaryPerday: number
}

interface AttendanceRecord {
  employeeId: number
  empName: string
  idNumber: string
  designation: string | null
  salaryPerday: number
  attendance: string
  attendanceDate?: string
  attendanceId?: number
  facePhotoUrl?: string | null
  checkInAt?: string | null
  checkOutAt?: string | null
  workedMinutes?: number | null
  workedDuration?: string
  attendanceMethod?: string | null
  verificationStatus?: string | null
  nextAction?: string
}

interface AttendanceEditForm {
  attendance: string
  checkInTime: string
  checkOutTime: string
  workedMinutes: string
}

const VALID_ATTENDANCE_STATUS = ["FD", "H", "PD", "A", "CL", "SL", "AL", "ML", "MED", "HPL", "EL", "PL", "PLT", "CO", "LWP", "WO", "PH"] as const
type AttendanceStatus = typeof VALID_ATTENDANCE_STATUS[number]

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  FD:  "Full Day",
  H:   "Half Day",
  PD:  "Partial Day",
  A:   "Absent",
  CL:  "Casual Leave",
  SL:  "Sick Leave",
  AL:  "Annual Leave",
  ML:  "Maternity Leave",
  MED: "Medical Leave",
  HPL: "Half Pay Leave",
  EL:  "Earned Leave",
  PL:  "Privilege Leave",
  PLT: "Paternity Leave",
  CO:  "Compensatory Leave",
  LWP: "Leave Without Pay",
  WO:  "Week Off",
  PH:  "Public Holiday",
}

const ATTENDANCE_ABBR: Record<AttendanceStatus, string> = {
  FD:  "FD",
  H:   "HD",
  PD:  "PD",
  A:   "A",
  CL:  "CL",
  SL:  "SL",
  AL:  "AL",
  ML:  "ML",
  MED: "MED",
  HPL: "HPL",
  EL:  "EL",
  PL:  "PL",
  PLT: "PLT",
  CO:  "CO",
  LWP: "LWP",
  WO:  "WO",
  PH:  "PH",
}

const OVERTIME_THRESHOLD_MIN = 9 * 60 // 9 hours

const normalizeStatusOption = (value?: string | null): AttendanceStatus => {
  const normalized = String(value || "").trim().toUpperCase()
  if ((VALID_ATTENDANCE_STATUS as readonly string[]).includes(normalized)) {
    return normalized as AttendanceStatus
  }
  if (normalized === "P" || normalized === "PRESENT") return "FD"
  if (normalized === "HALF DAY" || normalized === "HALF-DAY" || normalized === "HALFDAY") return "H"
  if (normalized === "PARTIAL DAY" || normalized === "PARTIAL-DAY" || normalized === "PARTIALDAY") return "PD"
  if (normalized === "ABSENT") return "A"
  return "A"
}

const calcOvertimeDisplay = (workedMinutes?: number | null): string => {
  if (!workedMinutes || workedMinutes <= OVERTIME_THRESHOLD_MIN) return "-"
  const overtimeMin = workedMinutes - OVERTIME_THRESHOLD_MIN
  const h = Math.floor(overtimeMin / 60)
  const m = overtimeMin % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

const formatTimeInIndia = (value?: string | null) => {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

interface Adjustment {
  adjustmentId: number
  employeeId: number
  adjustmentType: string
  amount: number
  adjustmentDate: string
  remarks: string | null
  employee: {
    empName: string
    idNumber: string
    designation: string | null
  }
}

interface AdjustmentFormState {
  adjustmentType: string
  amount: string
  adjustmentDate: string
  remarks: string
}

const createDefaultAdjustmentForm = (defaultDate: string): AdjustmentFormState => ({
  adjustmentType: "Allowance",
  amount: "",
  adjustmentDate: defaultDate,
  remarks: "",
})

interface PayrollRecord {
  payrollId: number
  employeeId: number
  month: number
  year: number
  basicSalary: number
  totalPresent: number
  totalHalfDay: number
  totalLeave: number
  totalAbsent: number
  totalAllowance: number
  totalIncentive: number
  totalAdvance: number
  totalDeduction?: number
  netSalary: number
  employee: {
    empName: string
    idNumber: string
    designation: string | null
    salaryPerday: number
  }
}

interface AttendanceCalendarRecord {
  date: string
  attendance: string
  workedMinutes?: number | null
  workedDuration?: string
  checkInAt?: string | null
  checkOutAt?: string | null
}

interface MobileAttendanceDetails {
  employee?: {
    empName?: string
    designation?: string | null
    facePhotoUrl?: string | null
  }
  nextAction?: "IN" | "OUT"
  todayRecord?: {
    attendance: string
    checkInAt: string | null
    checkOutAt: string | null
    workedDuration: string
  } | null
}

interface AttendanceCalendarEmployee {
  employeeId: number
  empName: string
  idNumber: string
  designation: string | null
}

const buildCalendarDays = (
  records: AttendanceCalendarRecord[],
  month: number,
  year: number,
  deriveStatus?: (workedMinutes: number) => AttendanceStatus,
) => {
  const recordByDate = new Map<string, AttendanceCalendarRecord>()
  records.forEach((record) => {
    recordByDate.set(record.date, record)
  })

  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const leading = firstDay.getDay()
  const cells: Array<{ key: string; day: number | null; date: string | null; status: string | null; workedMinutes?: number | null }> = []

  for (let index = 0; index < leading; index += 1) {
    cells.push({ key: `blank-start-${index}`, day: null, date: null, status: null })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const record = recordByDate.get(date)
    let status: AttendanceStatus
    if (
      record &&
      record.workedMinutes != null &&
      record.workedMinutes > 0 &&
      deriveStatus &&
      // Only re-derive for attendance codes that come from actual work (not leaves/holidays)
      ["FD", "P", "H", "PD", "A"].includes(normalizeStatusOption(record.attendance))
    ) {
      status = deriveStatus(record.workedMinutes)
    } else {
      status = normalizeStatusOption(record?.attendance)
    }
    cells.push({ key: date, day, date, status, workedMinutes: record?.workedMinutes })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-end-${cells.length}`, day: null, date: null, status: null })
  }

  return cells
}

// ── Payroll helpers ───────────────────────────────────────────────────────────

function formatPayrollDate(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleString("en-IN", { month: "short", year: "numeric" })
}

function PayrollFilterMenu({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const active = value !== "all"

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className={`ml-1 p-0.5 rounded transition-colors ${active ? "text-blue-600" : "text-slate-600 hover:text-slate-800"}`}
        title="Filter"
      >
        <ChevronDown className="w-[15px] h-[15px]" />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 min-w-[150px] rounded-lg border border-slate-200 bg-white shadow-lg z-50 py-1 max-h-56 overflow-y-auto">
          {(["all", ...options] as string[]).map((opt) => (
            <button
              key={opt}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors"
            >
              <span className="w-3 shrink-0">
                {opt === value && <Check className="w-3 h-3 text-blue-600" />}
              </span>
              <span className={opt === value ? "font-semibold text-blue-600" : "text-slate-700"}>
                {opt === "all" ? "All" : opt}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type AttendancePayrollTabKey = "attendance" | "adjustments" | "payroll" | "generate-payroll" | "leave-holidays"

interface AttendancePayrollModuleProps {
  activeTab?: AttendancePayrollTabKey
  onTabChange?: (tab: AttendancePayrollTabKey) => void
  attendanceDate?: string
  onAttendanceDateChange?: (value: string) => void
  viewerRole?: "admin" | "manager" | "technician"
  currentEmployeeId?: number | null
  searchTerm?: string
  onRecordsCountChange?: (count: number) => void
}

interface PayrollGenerationHistoryRecord {
  month: number
  year: number
  employeeCount: number
  totalAmount: number
  generatedAt: string | null
  generatedBy: string | null
}

export function AttendancePayrollModule({
  activeTab: controlledActiveTab,
  onTabChange,
  attendanceDate: controlledAttendanceDate,
  onAttendanceDateChange,
  viewerRole,
  currentEmployeeId,
  searchTerm = "",
  onRecordsCountChange,
}: AttendancePayrollModuleProps = {}) {
  const [internalActiveTab, setInternalActiveTab] = useState<AttendancePayrollTabKey>("attendance")
  const activeTab = controlledActiveTab ?? internalActiveTab
  const setActiveTab = (tab: AttendancePayrollTabKey) => {
    if (onTabChange) {
      onTabChange(tab)
      return
    }
    setInternalActiveTab(tab)
  }
  const [isAdminViewer, setIsAdminViewer] = useState(true)
  const [isTechnicianViewer, setIsTechnicianViewer] = useState(false)
  const todayIndia = getTodayISODateInIndia()
  const [currentIndiaYear, currentIndiaMonth] = useMemo(() => {
    const [year, month] = todayIndia.split("-").map(Number)
    return [year || new Date().getFullYear(), month || new Date().getMonth() + 1]
  }, [todayIndia])
  
  // Attendance Tab State
  // default to today so rows are visible immediately when opening Attendance tab
  const [internalAttendanceDate, setInternalAttendanceDate] = useState<string>(todayIndia)
  const attendanceDate = controlledAttendanceDate ?? internalAttendanceDate
  const setAttendanceDate = useCallback((value: string) => {
    if (onAttendanceDateChange) {
      onAttendanceDateChange(value)
      return
    }
    setInternalAttendanceDate(value)
  }, [onAttendanceDateChange])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [attendanceCalendarRecords, setAttendanceCalendarRecords] = useState<AttendanceCalendarRecord[]>([])
  const [loadingAttendanceCalendar, setLoadingAttendanceCalendar] = useState(false)
  const [attendanceCalendarMonth, setAttendanceCalendarMonth] = useState(currentIndiaMonth)
  const [attendanceCalendarYear, setAttendanceCalendarYear] = useState(currentIndiaYear)
  const [mobileAttendanceDetails, setMobileAttendanceDetails] = useState<MobileAttendanceDetails | null>(null)
  const [mobileAttendanceDialogOpen, setMobileAttendanceDialogOpen] = useState(false)
  const [mobileDeviceId, setMobileDeviceId] = useState<string | null>(null)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [loadingAttendanceHistory, setLoadingAttendanceHistory] = useState(false)
  const [attendanceHistoryRecords, setAttendanceHistoryRecords] = useState<AttendanceRecord[]>([])
  // Track local (unsaved) attendance edits and saving state
  const [modifiedAttendanceMap, setModifiedAttendanceMap] = useState<Record<number, string>>({})
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [editingAttendanceId, setEditingAttendanceId] = useState<number | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null)
  const [attendanceEditForm, setAttendanceEditForm] = useState<AttendanceEditForm | null>(null)
  const [employeeCalendarDialogOpen, setEmployeeCalendarDialogOpen] = useState(false)
  const [selectedCalendarEmployee, setSelectedCalendarEmployee] = useState<AttendanceCalendarEmployee | null>(null)
  const [employeeAttendanceCalendarRecords, setEmployeeAttendanceCalendarRecords] = useState<AttendanceCalendarRecord[]>([])
  const [loadingEmployeeAttendanceCalendar, setLoadingEmployeeAttendanceCalendar] = useState(false)
  const [employeeAttendanceCalendarMonth, setEmployeeAttendanceCalendarMonth] = useState(currentIndiaMonth)
  const [employeeAttendanceCalendarYear, setEmployeeAttendanceCalendarYear] = useState(currentIndiaYear)

  // Adjustments Tab State
  const [employees, setEmployees] = useState<Employee[]>([])
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [adjustmentFilterEmployeeId, setAdjustmentFilterEmployeeId] = useState("all")
  const [selectedAdjustmentEmployee, setSelectedAdjustmentEmployee] = useState<Employee | null>(null)
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormState>(() => createDefaultAdjustmentForm(todayIndia))
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<number | null>(null)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false)
  const [loadingAdjustments, setLoadingAdjustments] = useState(false)

  // Payroll Tab State
  const [payrollMonth, setPayrollMonth] = useState(currentIndiaMonth)
  const [payrollYear, setPayrollYear] = useState(currentIndiaYear)
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([])
  const [payrollGenerationHistory, setPayrollGenerationHistory] = useState<PayrollGenerationHistoryRecord[]>([])
  const [loadingPayroll, setLoadingPayroll] = useState(false)
  const [loadingPayrollHistory, setLoadingPayrollHistory] = useState(false)
  const [generatingPayroll, setGeneratingPayroll] = useState(false)
  const [payrollNameFilter, setPayrollNameFilter] = useState("all")
  const [payrollDateFilter, setPayrollDateFilter] = useState("all")
  const [attendanceNameFilter, setAttendanceNameFilter] = useState("all")
  const [attendanceDateFilter, setAttendanceDateFilter] = useState("all")
  const [adjustmentNameFilter, setAdjustmentNameFilter] = useState("all")
  const [adjustmentDateFilter, setAdjustmentDateFilter] = useState("all")
  const [attendancePolicyRules, setAttendancePolicyRules] = useState<{ operator: string; duration_minutes?: number; min_minutes?: number; max_minutes?: number; payable_percentage: number }[]>([])

  // Derive status from policy rules given worked minutes
  const deriveStatusFromPolicy = useCallback((workedMins: number): AttendanceStatus => {
    for (const rule of attendancePolicyRules) {
      let match = false
      if (rule.operator === "gte") match = workedMins >= (rule.duration_minutes ?? 0)
      else if (rule.operator === "gt") match = workedMins > (rule.duration_minutes ?? 0)
      else if (rule.operator === "lte") match = workedMins <= (rule.duration_minutes ?? 0)
      else if (rule.operator === "lt") match = workedMins < (rule.duration_minutes ?? 0)
      else if (rule.operator === "eq") match = workedMins === (rule.duration_minutes ?? 0)
      else if (rule.operator === "between") match = workedMins >= (rule.min_minutes ?? 0) && workedMins <= (rule.max_minutes ?? 0)
      if (match) {
        const pct = rule.payable_percentage
        if (pct >= 100) return "FD"
        if (pct <= 0) return "A"
        if (pct === 50) return "H"
        return "PD"
      }
    }
    return "A"
  }, [attendancePolicyRules])

  // Fetch employees on component mount
  useEffect(() => {
    fetchEmployees()
    fetch("/api/attendance-policy")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.attendance_rules)) {
          setAttendancePolicyRules(data.attendance_rules)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const role = String(viewerRole || localStorage.getItem("gms_user_role") || "admin").trim().toLowerCase()
    setIsAdminViewer(role !== "technician")
    setIsTechnicianViewer(role === "technician")
  }, [viewerRole])

  // Fetch attendance when date changes (only when a date is selected)
  useEffect(() => {
    if (activeTab === "attendance" && attendanceDate) {
      fetchAttendance(attendanceDate)
    }
  }, [activeTab, attendanceDate, currentEmployeeId, isTechnicianViewer])

  useEffect(() => {
    if (activeTab === "attendance" && isTechnicianViewer && Number.isInteger(currentEmployeeId)) {
      fetchAttendanceCalendar(attendanceCalendarMonth, attendanceCalendarYear)
      fetchMobileAttendanceDetails()
    }
  }, [
    activeTab,
    isTechnicianViewer,
    currentEmployeeId,
    attendanceCalendarMonth,
    attendanceCalendarYear,
  ])

  // Fetch adjustments when tab changes
  useEffect(() => {
    if (activeTab === "adjustments") {
      fetchAdjustments()
    }
  }, [activeTab])

  // Fetch payroll when tab changes or month/year changes
  useEffect(() => {
    if (activeTab === "payroll") {
      fetchPayroll()
    }
  }, [activeTab, payrollMonth, payrollYear])

  useEffect(() => {
    if (activeTab === "generate-payroll" && !isTechnicianViewer) {
      fetchPayrollGenerationHistory()
    }
  }, [activeTab, isTechnicianViewer])

  const fetchEmployees = async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch("/api/attendance-payroll/employees", { signal: controller.signal })

      if (!response.ok) {
        let bodyText = ""
        try {
          bodyText = await response.text()
        } catch (e) {
          /* ignore */
        }
        console.error(`fetchEmployees: bad response ${response.status} ${response.statusText}`, bodyText)
        toast.error(`Failed to load employees (status ${response.status})`)
        return
      }

      const data = await response.json()
      setEmployees(data)
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        console.error('fetchEmployees: request timed out')
        toast.error('Timed out loading employees')
      } else {
        console.error('Error fetching employees:', error)
        toast.error('Failed to fetch employees — check server or network')
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  const fetchAttendance = useCallback(async (selectedDate = attendanceDate) => {
    setLoadingAttendance(true)
    try {
      const params = new URLSearchParams({ date: selectedDate })
      if (isTechnicianViewer && Number.isInteger(currentEmployeeId)) {
        params.set("employeeId", String(currentEmployeeId))
      }

      const response = await fetch(`/api/attendance-payroll/attendance?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch attendance")
      const data = await response.json()
      setAttendanceRecords(data)
      setAttendanceNameFilter("all")
      setAttendanceDateFilter("all")
      // clear any local unsaved edits when loading from server
      setModifiedAttendanceMap({})
    } catch (error) {
      console.error("Error fetching attendance:", error)
      toast.error("Failed to fetch attendance")
    } finally {
      setLoadingAttendance(false)
    }
  }, [attendanceDate, isTechnicianViewer, currentEmployeeId])

  const fetchAttendanceCalendarRecords = useCallback(async (employeeId: number, month: number, year: number) => {
    const params = new URLSearchParams({
      employeeId: String(employeeId),
      month: String(month),
      year: String(year),
    })
    const response = await fetch(`/api/attendance-payroll/attendance?${params.toString()}`, { cache: "no-store" })
    if (!response.ok) {
      throw new Error("Failed to fetch attendance calendar")
    }

    const data = await response.json()
    return Array.isArray(data?.records) ? data.records as AttendanceCalendarRecord[] : []
  }, [])

  const fetchAttendanceCalendar = useCallback(async (month: number, year: number) => {
    if (!Number.isInteger(currentEmployeeId)) {
      return
    }

    setLoadingAttendanceCalendar(true)
    try {
      const records = await fetchAttendanceCalendarRecords(Number(currentEmployeeId), month, year)
      setAttendanceCalendarRecords(records)
    } catch (error) {
      console.error("Error fetching attendance calendar:", error)
      setAttendanceCalendarRecords([])
      toast.error("Failed to fetch attendance calendar")
    } finally {
      setLoadingAttendanceCalendar(false)
    }
  }, [currentEmployeeId, fetchAttendanceCalendarRecords])

  const fetchMobileAttendanceDetails = async () => {
    if (!Number.isInteger(currentEmployeeId)) {
      setMobileAttendanceDetails(null)
      return
    }

    try {
      const [attRes, meRes] = await Promise.all([
        fetch(`/api/mobile-attendance?employeeId=${currentEmployeeId}`, { cache: "no-store" }),
        fetch("/api/auth/me", { cache: "no-store" }),
      ])
      if (!attRes.ok) throw new Error("Failed to fetch mobile attendance details")
      const data = await attRes.json()
      setMobileAttendanceDetails(data)
      if (meRes.ok) {
        const meData = await meRes.json()
        setMobileDeviceId(String(meData?.user?.approvedDeviceId || ""))
      }
    } catch (error) {
      console.error("Error fetching mobile attendance details:", error)
      setMobileAttendanceDetails(null)
    }
  }

  const timeInputFromDate = (value?: string | null) => {
    if (!value) return ""
    const date = new Date(value)
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return `${hours}:${minutes}`
  }

  const openAttendanceRowEditor = useCallback((record: AttendanceRecord) => {
    console.log('[AttendanceModule] Opening edit for employee:', record.employeeId, record.empName)
    setEditingAttendanceId(record.attendanceId ?? null)
    setEditingEmployeeId(record.employeeId)
    setAttendanceEditForm({
      attendance: normalizeStatusOption(record.attendance),
      checkInTime: timeInputFromDate(record.checkInAt),
      checkOutTime: timeInputFromDate(record.checkOutAt),
      workedMinutes: record.workedMinutes != null ? String(record.workedMinutes) : "",
    })
  }, [])

  const resetAttendanceRowEditor = () => {
    setEditingAttendanceId(null)
    setEditingEmployeeId(null)
    setAttendanceEditForm(null)
  }

  const saveAttendanceRow = async (record: AttendanceRecord) => {
    if (!attendanceEditForm) {
      return
    }

    try {
      let rowAttendanceId = editingAttendanceId

      if (!rowAttendanceId) {
        const createResponse = await fetch("/api/attendance-payroll/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: record.employeeId,
            attendanceDate,
            attendance: normalizeStatusOption(attendanceEditForm.attendance),
          }),
        })

        const createData = await createResponse.json()
        if (!createResponse.ok) {
          throw new Error(createData.error || "Failed to create attendance row")
        }

        rowAttendanceId = createData.attendanceId
      }

      const patchBody: any = {
        attendanceId: rowAttendanceId,
        attendanceDate,
        attendance: normalizeStatusOption(attendanceEditForm.attendance),
        checkInTime: attendanceEditForm.checkInTime,
        checkOutTime: attendanceEditForm.checkOutTime,
        workedMinutes: attendanceEditForm.workedMinutes,
      }

      const patchResponse = await fetch("/api/attendance-payroll/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      })

      const patchData = await patchResponse.json()
      if (!patchResponse.ok) {
        throw new Error(patchData.error || "Failed to update attendance row")
      }

      toast.success("Attendance row updated")
      resetAttendanceRowEditor()
      fetchAttendance()
    } catch (error) {
      console.error("Error saving attendance row:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save attendance row")
    }
  }

  const deleteAttendanceRow = async (record: AttendanceRecord) => {
    if (!record.attendanceId) {
      toast.error("No attendance record to delete")
      return
    }

    if (!confirm("Delete this attendance row?")) return

    try {
      const response = await fetch(`/api/attendance-payroll/attendance?attendanceId=${record.attendanceId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete attendance row")
      }

      toast.success("Attendance row deleted")
      if (editingAttendanceId === record.attendanceId) {
        resetAttendanceRowEditor()
      }
      fetchAttendance()
    } catch (error) {
      console.error("Error deleting attendance row:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete attendance row")
    }
  }

  // Handle date selection — prompt if there are unsaved edits
  const handleAttendanceDateChange = (value: string) => {
    if (Object.keys(modifiedAttendanceMap).length > 0) {
      if (!confirm("You have unsaved changes. Discard and continue?")) return
      setModifiedAttendanceMap({})
    }

    setAttendanceDate(value)

    if (activeTab === "attendance" && value) {
      void fetchAttendance(value)
    }
  }

  // Update local attendance value (mark as modified). Persist only when user clicks "Save Attendance".
  const updateAttendance = (employeeId: number, attendance: string) => {
    // update UI immediately
    setAttendanceRecords((prev) =>
      prev.map((record) =>
        record.employeeId === employeeId ? { ...record, attendance } : record
      )
    )

    // mark this record as modified (unsaved)
    setModifiedAttendanceMap((prev) => ({ ...prev, [employeeId]: attendance }))
  }

  // Bulk-save modified attendance entries for the selected date
  const saveAttendance = async () => {
    const modifiedIds = Object.keys(modifiedAttendanceMap)
    if (modifiedIds.length === 0) {
      toast.error("No changes to save")
      return
    }

    const recordsToSave = attendanceRecords
      .filter((r) => modifiedAttendanceMap[r.employeeId] && r.attendance)
      .map((r) => ({ employeeId: r.employeeId, attendanceDate, attendance: r.attendance }))

    if (recordsToSave.length === 0) {
      toast.error("No valid attendance entries to save")
      return
    }

    setSavingAttendance(true)
    try {
      const res = await fetch("/api/attendance-payroll/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceRecords: recordsToSave }),
      })

      if (!res.ok) throw new Error("Failed to save attendance")
      const data = await res.json()
      toast.success(`Saved ${data.count || recordsToSave.length} attendance records`)

      // clear local dirty state and refresh from server to get attendanceIds
      setModifiedAttendanceMap({})
      fetchAttendance()
    } catch (err) {
      console.error("Error saving attendance:", err)
      toast.error("Failed to save attendance")
    } finally {
      setSavingAttendance(false)
    }
  }

  const fetchAdjustments = async () => {
    setLoadingAdjustments(true)
    try {
      const params = new URLSearchParams()
      if (isTechnicianViewer && Number.isInteger(currentEmployeeId)) {
        params.set("employeeId", String(currentEmployeeId))
      }
      const url = params.toString()
        ? `/api/attendance-payroll/adjustments?${params.toString()}`
        : "/api/attendance-payroll/adjustments"
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch adjustments")
      const data = await response.json()
      setAdjustments(data)
      setAdjustmentNameFilter("all")
      setAdjustmentDateFilter("all")
    } catch (error) {
      console.error("Error fetching adjustments:", error)
      toast.error("Failed to fetch adjustments")
    } finally {
      setLoadingAdjustments(false)
    }
  }

  const resetAdjustmentForm = () => {
    setEditingAdjustmentId(null)
    setSelectedAdjustmentEmployee(null)
    setAdjustmentForm(createDefaultAdjustmentForm(todayIndia))
  }

  const handleAdjustmentModalOpenChange = (open: boolean) => {
    setIsAdjustmentModalOpen(open)
    if (!open) {
      resetAdjustmentForm()
    }
  }

  const openNewAdjustmentModal = () => {
    resetAdjustmentForm()
    setIsAdjustmentModalOpen(true)
  }

  const openEditAdjustmentModal = (adjustment: Adjustment) => {
    setEditingAdjustmentId(adjustment.adjustmentId)
    setSelectedAdjustmentEmployee({
      employeeId: adjustment.employeeId,
      empName: adjustment.employee.empName,
      idNumber: adjustment.employee.idNumber,
      designation: adjustment.employee.designation,
      salaryPerday: 0,
    })
    setAdjustmentForm({
      adjustmentType: adjustment.adjustmentType,
      amount: String(adjustment.amount),
      adjustmentDate: String(adjustment.adjustmentDate).slice(0, 10),
      remarks: adjustment.remarks || "",
    })
    setIsAdjustmentModalOpen(true)
  }

  const regeneratePayrollForDate = async (dateValue: string) => {
    const [yearValue, monthValue] = String(dateValue || "").split("-").map(Number)
    const adjMonth = Number.isInteger(monthValue) && monthValue > 0 ? monthValue : currentIndiaMonth
    const adjYear = Number.isInteger(yearValue) && yearValue > 0 ? yearValue : currentIndiaYear

    try {
      await fetch("/api/attendance-payroll/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: adjMonth, year: adjYear, generatedBy: "UI: adjustment" }),
      })

      if (activeTab === "payroll" && payrollMonth === adjMonth && payrollYear === adjYear) {
        fetchPayroll()
      }
    } catch (error) {
      console.error("Error regenerating payroll after adjustment:", error)
    }
  }

  const saveAdjustment = async () => {
    if (isTechnicianViewer) {
      toast.error("Technicians can only view payment history")
      return
    }

    if (!selectedAdjustmentEmployee) {
      toast.error("Please select an employee")
      return
    }

    if (!adjustmentForm.amount || parseFloat(adjustmentForm.amount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    setIsSavingAdjustment(true)
    try {
      const response = await fetch("/api/attendance-payroll/adjustments", {
        method: editingAdjustmentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingAdjustmentId ? { adjustmentId: editingAdjustmentId } : { employeeId: selectedAdjustmentEmployee.employeeId }),
          adjustmentType: adjustmentForm.adjustmentType,
          amount: parseFloat(adjustmentForm.amount),
          adjustmentDate: adjustmentForm.adjustmentDate,
          remarks: adjustmentForm.remarks || null,
        }),
      })

      if (!response.ok) throw new Error("Failed to save adjustment")

      toast.success(editingAdjustmentId ? "Adjustment updated" : "Adjustment saved")
      handleAdjustmentModalOpenChange(false)
      fetchAdjustments()
      await regeneratePayrollForDate(adjustmentForm.adjustmentDate)
    } catch (error) {
      console.error("Error saving adjustment:", error)
      toast.error("Failed to save adjustment")
    } finally {
      setIsSavingAdjustment(false)
    }
  }

  const deleteAdjustment = async (adjustment: Adjustment) => {
    if (isTechnicianViewer) {
      toast.error("Technicians can only view payment history")
      return
    }

    if (!confirm("Are you sure you want to delete this adjustment?")) return

    try {
      const response = await fetch(
        `/api/attendance-payroll/adjustments?adjustmentId=${adjustment.adjustmentId}`,
        { method: "DELETE" }
      )

      if (!response.ok) throw new Error("Failed to delete adjustment")

      toast.success("Adjustment deleted")
      fetchAdjustments()
      await regeneratePayrollForDate(String(adjustment.adjustmentDate).slice(0, 10))
    } catch (error) {
      console.error("Error deleting adjustment:", error)
      toast.error("Failed to delete adjustment")
    }
  }

  const fetchPayroll = async () => {
    setLoadingPayroll(true)
    try {
      const params = new URLSearchParams({
        month: String(payrollMonth),
        year: String(payrollYear),
      })
      if (isTechnicianViewer && Number.isInteger(currentEmployeeId)) {
        params.set("employeeId", String(currentEmployeeId))
      }

      const response = await fetch(`/api/attendance-payroll/payroll?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch payroll")
      const data = await response.json()
      setPayrollRecords(data)
      setPayrollNameFilter("all")
      setPayrollDateFilter("all")
    } catch (error) {
      console.error("Error fetching payroll:", error)
      toast.error("Failed to fetch payroll")
    } finally {
      setLoadingPayroll(false)
    }
  }

  const fetchPayrollGenerationHistory = async () => {
    setLoadingPayrollHistory(true)
    try {
      const response = await fetch("/api/attendance-payroll/payroll?summary=1", { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to fetch payroll generation history")
      const data = await response.json()
      setPayrollGenerationHistory(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching payroll generation history:", error)
      toast.error("Failed to fetch payroll generation history")
      setPayrollGenerationHistory([])
    } finally {
      setLoadingPayrollHistory(false)
    }
  }

  const runPayrollGeneration = async (month: number, year: number, regenerate = false) => {
    setGeneratingPayroll(true)
    try {
      const response = await fetch("/api/attendance-payroll/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, regenerate }),
      })

      if (!response.ok) {
        throw new Error(regenerate ? "Failed to regenerate payroll" : "Failed to generate payroll")
      }

      setPayrollMonth(month)
      setPayrollYear(year)

      await Promise.all([fetchPayroll(), fetchPayrollGenerationHistory()])
      toast.success(regenerate ? "Payroll regenerated successfully" : "Payroll generated successfully")
    } catch (error) {
      console.error("Error running payroll generation:", error)
      toast.error(regenerate ? "Failed to regenerate payroll" : "Failed to generate payroll")
    } finally {
      setGeneratingPayroll(false)
    }
  }

  const printSalarySlip = async (payroll: PayrollRecord) => {
    // defensive validation and detailed error reporting
    try {
      if (!payroll || !payroll.employee) throw new Error('Invalid payroll data')

      // Fetch shop settings
      const shopSettingsResponse = await fetch("/api/settings/shop")
      if (!shopSettingsResponse.ok) {
        throw new Error("Failed to fetch shop settings")
      }
      const shopSettings = await shopSettingsResponse.json()

      const payload = {
        employeeName: String(payroll.employee.empName || 'NA'),
        employeeId: String(payroll.employee.idNumber || 'NA'),
        designation: String(payroll.employee.designation || 'N/A'),
        month: Number(payroll.month || currentIndiaMonth),
        year: Number(payroll.year || currentIndiaYear),
        salaryPerDay: Number(payroll.employee.salaryPerday || 0),
        totalPresent: Number(payroll.totalPresent || 0),
        totalHalfDay: Number(payroll.totalHalfDay || 0),
        totalLeave: Number(payroll.totalLeave || 0),
        totalAbsent: Number(payroll.totalAbsent || 0),
        basicSalary: Number(payroll.basicSalary || 0),
        allowances: Number(payroll.totalAllowance || 0),
        incentives: Number(payroll.totalIncentive || 0),
        deductions: Number(payroll.totalAdvance || 0) + Number(payroll.totalDeduction || 0),
        netSalary: Number(payroll.netSalary || 0),
        shopSettings: {
          shopName: shopSettings.shopName || "AUTO GARAGE",
          address: shopSettings.address,
          city: shopSettings.city,
          state: shopSettings.state,
          pincode: shopSettings.pincode,
          phone1: shopSettings.phone1,
          phone2: shopSettings.phone2,
        },
      }

      console.debug('[AttendancePayrollModule] printSalarySlip payload:', payload)

      await generateSalarySlipPdf(payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Error printing salary slip:', message)
      toast.error(`Failed to print salary slip: ${message}`)
    }
  }

  const filteredAdjustments = adjustmentFilterEmployeeId === "all"
    ? adjustments
    : adjustments.filter((adj) => String(adj.employeeId) === adjustmentFilterEmployeeId)

  const searchQuery = searchTerm.trim().toLowerCase()

  const matchedEmployeesForSearch = useMemo(() => {
    if (!searchQuery) return [] as Employee[]
    return employees.filter((employee) =>
      String(employee.empName || "").toLowerCase().includes(searchQuery) ||
      String(employee.idNumber || "").toLowerCase().includes(searchQuery)
    )
  }, [employees, searchQuery])

  useEffect(() => {
    if (activeTab !== "attendance" || isTechnicianViewer || !searchQuery) {
      setAttendanceHistoryRecords([])
      setLoadingAttendanceHistory(false)
      return
    }

    if (matchedEmployeesForSearch.length !== 1) {
      setAttendanceHistoryRecords([])
      setLoadingAttendanceHistory(false)
      return
    }

    const selectedEmployee = matchedEmployeesForSearch[0]
    let cancelled = false

    const loadHistory = async () => {
      setLoadingAttendanceHistory(true)
      try {
        const params = new URLSearchParams({
          employeeId: String(selectedEmployee.employeeId),
          history: "1",
        })
        const response = await fetch(`/api/attendance-payroll/attendance?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) throw new Error("Failed to fetch attendance history")
        const data = await response.json()
        if (!cancelled) {
          setAttendanceHistoryRecords(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error("Error fetching attendance history:", error)
        if (!cancelled) {
          setAttendanceHistoryRecords([])
          toast.error("Failed to fetch attendance history")
        }
      } finally {
        if (!cancelled) {
          setLoadingAttendanceHistory(false)
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [activeTab, isTechnicianViewer, matchedEmployeesForSearch, searchQuery])

  const visibleAttendanceRecords = useMemo(() => {
    let base = attendanceRecords
    if (attendanceNameFilter !== "all") base = base.filter((r) => r.empName === attendanceNameFilter)
    if (attendanceDateFilter !== "all") base = base.filter((r) => formatDateDDMMYY(r.attendanceDate) === attendanceDateFilter)
    // Sort: records with a check-in time first (most recent attendanceId desc), then without
    return [...base].sort((a, b) => {
      const aHas = a.checkInAt ? 1 : 0
      const bHas = b.checkInAt ? 1 : 0
      if (aHas !== bHas) return bHas - aHas
      return (b.attendanceId ?? 0) - (a.attendanceId ?? 0)
    })
  }, [attendanceRecords, attendanceNameFilter, attendanceDateFilter])

  const isEmployeeHistoryMode =
    activeTab === "attendance" && !isTechnicianViewer && searchQuery.length > 0 && matchedEmployeesForSearch.length === 1

  const renderedAttendanceRecords = isEmployeeHistoryMode ? attendanceHistoryRecords : visibleAttendanceRecords

  const visibleAdjustments = useMemo(() => {
    let records = filteredAdjustments
    if (adjustmentNameFilter !== "all") records = records.filter((a) => a.employee.empName === adjustmentNameFilter)
    if (adjustmentDateFilter !== "all") records = records.filter((a) => formatDateDDMMYY(a.adjustmentDate) === adjustmentDateFilter)
    return records
  }, [filteredAdjustments, adjustmentNameFilter, adjustmentDateFilter])

  const visiblePayrollRecords = useMemo(() => {
    let records = payrollRecords
    if (searchQuery) {
      records = records.filter((p) =>
        String(p.employee.empName || "").toLowerCase().includes(searchQuery) ||
        String(p.employee.idNumber || "").toLowerCase().includes(searchQuery) ||
        String(p.employee.designation || "").toLowerCase().includes(searchQuery)
      )
    }
    if (payrollNameFilter !== "all") {
      records = records.filter((p) => p.employee.empName === payrollNameFilter)
    }
    if (payrollDateFilter !== "all") {
      records = records.filter((p) => formatPayrollDate(p.month, p.year) === payrollDateFilter)
    }
    return records
  }, [payrollRecords, searchQuery, payrollNameFilter, payrollDateFilter])

  const visiblePayrollHistory = useMemo(() => {
    return payrollGenerationHistory
  }, [payrollGenerationHistory])

  useEffect(() => {
    const count =
      activeTab === "attendance"
        ? renderedAttendanceRecords.length
        : activeTab === "adjustments"
          ? visibleAdjustments.length
          : activeTab === "payroll"
            ? visiblePayrollRecords.length
            : visiblePayrollHistory.length
    onRecordsCountChange?.(count)
  }, [activeTab, renderedAttendanceRecords.length, visibleAdjustments.length, visiblePayrollRecords.length, visiblePayrollHistory.length, onRecordsCountChange])

  const technicianCalendarDays = useMemo(() => {
    return buildCalendarDays(attendanceCalendarRecords, attendanceCalendarMonth, attendanceCalendarYear, deriveStatusFromPolicy)
  }, [attendanceCalendarRecords, attendanceCalendarMonth, attendanceCalendarYear, deriveStatusFromPolicy])

  const getCalendarStatusClass = (status: string | null) => {
    if (status === "FD" || status === "P") return "bg-emerald-100 text-emerald-800 border-emerald-300"
    if (status === "H") return "bg-amber-100 text-amber-800 border-amber-300"
    if (status === "PD") return "bg-blue-100 text-blue-800 border-blue-300"
    if (status === "A") return "bg-rose-100 text-rose-800 border-rose-300"
    return "bg-white text-slate-500 border-slate-200"
  }

  const monthLabel = useMemo(() => {
    return new Date(attendanceCalendarYear, attendanceCalendarMonth - 1, 1).toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    })
  }, [attendanceCalendarMonth, attendanceCalendarYear])

  const employeeCalendarDays = useMemo(() => {
    return buildCalendarDays(employeeAttendanceCalendarRecords, employeeAttendanceCalendarMonth, employeeAttendanceCalendarYear, deriveStatusFromPolicy)
  }, [employeeAttendanceCalendarRecords, employeeAttendanceCalendarMonth, employeeAttendanceCalendarYear, deriveStatusFromPolicy])

  const employeeCalendarMonthLabel = useMemo(() => {
    return new Date(employeeAttendanceCalendarYear, employeeAttendanceCalendarMonth - 1, 1).toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    })
  }, [employeeAttendanceCalendarMonth, employeeAttendanceCalendarYear])

  const openEmployeeCalendar = useCallback((record: AttendanceRecord) => {
    const [selectedYear, selectedMonth] = String(attendanceDate || todayIndia).split("-").map(Number)
    setSelectedCalendarEmployee({
      employeeId: record.employeeId,
      empName: record.empName,
      idNumber: record.idNumber,
      designation: record.designation,
    })
    setEmployeeAttendanceCalendarMonth(
      Number.isInteger(selectedMonth) && selectedMonth > 0 ? selectedMonth : currentIndiaMonth
    )
    setEmployeeAttendanceCalendarYear(
      Number.isInteger(selectedYear) && selectedYear > 0 ? selectedYear : currentIndiaYear
    )
    setEmployeeCalendarDialogOpen(true)
  }, [attendanceDate, currentIndiaMonth, currentIndiaYear, todayIndia])

  useEffect(() => {
    if (!employeeCalendarDialogOpen || !selectedCalendarEmployee) {
      return
    }

    let cancelled = false

    const loadCalendar = async () => {
      setLoadingEmployeeAttendanceCalendar(true)
      try {
        const records = await fetchAttendanceCalendarRecords(
          selectedCalendarEmployee.employeeId,
          employeeAttendanceCalendarMonth,
          employeeAttendanceCalendarYear
        )
        if (!cancelled) {
          setEmployeeAttendanceCalendarRecords(records)
        }
      } catch (error) {
        console.error("Error fetching employee attendance calendar:", error)
        if (!cancelled) {
          setEmployeeAttendanceCalendarRecords([])
          toast.error("Failed to fetch employee attendance calendar")
        }
      } finally {
        if (!cancelled) {
          setLoadingEmployeeAttendanceCalendar(false)
        }
      }
    }

    void loadCalendar()

    return () => {
      cancelled = true
    }
  }, [
    employeeAttendanceCalendarMonth,
    employeeAttendanceCalendarYear,
    employeeCalendarDialogOpen,
    fetchAttendanceCalendarRecords,
    selectedCalendarEmployee,
  ])

  return (
    <>
    <div className="space-y-6">
        {/* Tab Panels (rendered conditionally) */}
        {activeTab === "attendance" && (
          <div className="space-y-4" style={{ paddingTop: "var(--master-gap)" }}>
            {isTechnicianViewer ? (
              <div className="space-y-4">
                {!Number.isInteger(currentEmployeeId) ? (
                  <Card className="p-4 text-sm text-muted-foreground">
                    Your account is not linked to an employee profile yet. Please contact admin.
                  </Card>
                ) : (
                  <>
                    <Card className="p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xl leading-tight font-semibold text-slate-900">
                            {mobileAttendanceDetails?.employee?.empName || "Employee"}
                          </div>
                          <div className="text-base text-slate-700">
                            {mobileAttendanceDetails?.employee?.designation || "Technician"}
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            Next action: <span className="font-semibold text-slate-800">{mobileAttendanceDetails?.nextAction || "IN"}</span>
                          </div>
                        </div>
                        {mobileAttendanceDetails?.employee?.facePhotoUrl ? (
                          <Image
                            src={mobileAttendanceDetails.employee.facePhotoUrl}
                            alt={mobileAttendanceDetails.employee.empName || "Employee"}
                            width={72}
                            height={72}
                            className="h-[72px] w-[72px] rounded-xl object-cover border border-slate-200"
                            unoptimized
                          />
                        ) : (
                          <div className="h-[72px] w-[72px] rounded-xl border border-slate-200 bg-slate-100" />
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                          <div className="text-xs text-slate-700">Status</div>
                          <div className="text-sm font-semibold text-blue-700 leading-tight">
                            {mobileAttendanceDetails?.nextAction === "OUT" ? "Checked In" : "Ready"}
                          </div>
                          <div className="text-xs text-blue-700 mt-1">
                            {mobileAttendanceDetails?.nextAction === "OUT" ? "Awaiting check-out" : "Ready for check-in"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs text-slate-700">Worked</div>
                          <div className="text-sm font-semibold text-slate-900 leading-tight">
                            {mobileAttendanceDetails?.todayRecord?.workedDuration || "0m"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs text-slate-700">Check In</div>
                          <div className="text-sm font-semibold text-slate-900 leading-tight">
                            {formatTimeInIndia(mobileAttendanceDetails?.todayRecord?.checkInAt)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs text-slate-700">Check Out</div>
                          <div className="text-sm font-semibold text-slate-900 leading-tight">
                            {formatTimeInIndia(mobileAttendanceDetails?.todayRecord?.checkOutAt)}
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        className="w-full h-12 text-base font-semibold bg-red-600 hover:bg-red-700"
                        onClick={() => setMobileAttendanceDialogOpen(true)}
                      >
                        Mark {mobileAttendanceDetails?.nextAction || "IN"}
                      </Button>

                      {mobileAttendanceDialogOpen &&
                        Number.isInteger(currentEmployeeId) &&
                        mobileDeviceId && (
                          <AttendanceCaptureOverlay
                            employeeId={currentEmployeeId!}
                            deviceId={mobileDeviceId}
                            nextAction={mobileAttendanceDetails?.nextAction ?? "IN"}
                            facePhotoUrl={mobileAttendanceDetails?.employee?.facePhotoUrl ?? null}
                            onSuccess={() => {
                              setMobileAttendanceDialogOpen(false)
                              void fetchMobileAttendanceDetails()
                              if (attendanceDate) void fetchAttendance(attendanceDate)
                              void fetchAttendanceCalendar(attendanceCalendarMonth, attendanceCalendarYear)
                            }}
                            onCancel={() => setMobileAttendanceDialogOpen(false)}
                          />
                        )}
                    </Card>

                    <Card className="p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">My Attendance Calendar</h3>
                        <div className="flex items-center gap-2">
                          <Select
                            value={String(attendanceCalendarMonth)}
                            onValueChange={(value) => setAttendanceCalendarMonth(parseInt(value, 10))}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                <SelectItem key={month} value={String(month)}>
                                  {new Date(2000, month - 1).toLocaleString("en-IN", { month: "long" })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={String(attendanceCalendarYear)}
                            onValueChange={(value) => setAttendanceCalendarYear(parseInt(value, 10))}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 5 }, (_, i) => currentIndiaYear - i).map((year) => (
                                <SelectItem key={year} value={String(year)}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">{monthLabel}</div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Full Day</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Half Day</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Partial Day</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Absent</span>
                      </div>

                      <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground">
                        {[
                          "Sun",
                          "Mon",
                          "Tue",
                          "Wed",
                          "Thu",
                          "Fri",
                          "Sat",
                        ].map((label) => (
                          <div key={label} className="text-center">{label}</div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {technicianCalendarDays.map((cell) => (
                          <div
                            key={cell.key}
                            className={`h-16 rounded-md border p-2 text-xs ${getCalendarStatusClass(cell.status)}`}
                          >
                            {cell.day ? (
                              <>
                                <div className="font-semibold">{cell.day}</div>
                                <div className="mt-0.5 text-[10px] leading-tight font-medium">
                                  {cell.status ? (ATTENDANCE_ABBR[cell.status as AttendanceStatus] ?? cell.status) : "-"}
                                </div>
                                {cell.workedMinutes != null && cell.workedMinutes > 0 && ["FD", "H", "PD"].includes(cell.status ?? "") && (
                                  <div className="text-[9px] opacity-70 leading-tight">
                                    {Math.floor(cell.workedMinutes / 60)}h {cell.workedMinutes % 60}m
                                  </div>
                                )}
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      {loadingAttendanceCalendar ? (
                        <div className="text-xs text-muted-foreground">Loading attendance calendar...</div>
                      ) : null}
                    </Card>
                  </>
                )}
              </div>
            ) : (
              <>
            <div className="form-table-wrapper form-table-wrapper--independent-tl attendance-payroll-table-wrapper mobile-attendance-table-wrapper">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="w-[4%] bg-slate-100 text-center">#</th>
                    <th className="w-[18%] bg-slate-100 text-center">
                      <span className="inline-flex items-center justify-center">
                        Employee Name
                        <PayrollFilterMenu
                          options={[...new Set(attendanceRecords.map((r) => r.empName))].sort()}
                          value={attendanceNameFilter}
                          onChange={setAttendanceNameFilter}
                        />
                      </span>
                    </th>
                    <th className="w-[8%] bg-slate-100 text-center">
                      <span className="inline-flex items-center justify-center">
                        Date
                        <PayrollFilterMenu
                          options={[...new Set(attendanceRecords.map((r) => formatDateDDMMYY(r.attendanceDate) ?? ""))].filter(Boolean).sort()}
                          value={attendanceDateFilter}
                          onChange={setAttendanceDateFilter}
                        />
                      </span>
                    </th>
                    <th className="w-[10%] bg-slate-100 text-center">Designation</th>
                    <th className="w-[8%] bg-slate-100 text-center">Check In</th>
                    <th className="w-[8%] bg-slate-100 text-center">Check Out</th>
                    <th className="w-[8%] bg-slate-100 text-center">Worked Time</th>
                    <th className="w-[8%] bg-slate-100 text-center">Overtime</th>
                    <th className="w-[16%] bg-slate-100 text-center">Status</th>
                    <th className="w-[10%] bg-slate-100 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:text-center">
                  {renderedAttendanceRecords.map((record, index) => (
                    <tr key={record.attendanceId ?? `${record.employeeId}-${index}`} className="h-8">
                      <td className="h-8">{index + 1}</td>
                      <td className="font-medium h-8">{record.empName}</td>
                      <td className="h-8 text-slate-500">{formatDateDDMMYY(record.attendanceDate) || "-"}</td>
                      <td className="h-8">{record.designation || "N/A"}</td>
                      {editingAttendanceId === (record.attendanceId ?? null) && attendanceEditForm ? (
                        <>
                          <td className="h-8">
                            <Input
                              type="time"
                              value={attendanceEditForm.checkInTime}
                              onChange={(e) => {
                                const newCheckIn = e.target.value
                                setAttendanceEditForm((prev) => {
                                  if (!prev) return prev
                                  const updated = { ...prev, checkInTime: newCheckIn }
                                  if (newCheckIn && prev.checkOutTime) {
                                    const [inH, inM] = newCheckIn.split(":").map(Number)
                                    const [outH, outM] = prev.checkOutTime.split(":").map(Number)
                                    const worked = (outH * 60 + outM) - (inH * 60 + inM)
                                    if (worked > 0) {
                                      updated.workedMinutes = String(worked)
                                      updated.attendance = deriveStatusFromPolicy(worked)
                                    }
                                  }
                                  return updated
                                })
                              }}
                              className="h-8"
                            />
                          </td>
                          <td className="h-8">
                            <Input
                              type="time"
                              value={attendanceEditForm.checkOutTime}
                              onChange={(e) => {
                                const newCheckOut = e.target.value
                                setAttendanceEditForm((prev) => {
                                  if (!prev) return prev
                                  const updated = { ...prev, checkOutTime: newCheckOut }
                                  if (prev.checkInTime && newCheckOut) {
                                    const [inH, inM] = prev.checkInTime.split(":").map(Number)
                                    const [outH, outM] = newCheckOut.split(":").map(Number)
                                    const worked = (outH * 60 + outM) - (inH * 60 + inM)
                                    if (worked > 0) {
                                      updated.workedMinutes = String(worked)
                                      updated.attendance = deriveStatusFromPolicy(worked)
                                    }
                                  }
                                  return updated
                                })
                              }}
                              className="h-8"
                            />
                          </td>
                          <td className="h-8">
                            <Input
                              type="number"
                              min={0}
                              value={attendanceEditForm.workedMinutes}
                              onChange={(e) =>
                                setAttendanceEditForm((prev) =>
                                  prev ? { ...prev, workedMinutes: e.target.value } : prev
                                )
                              }
                              className="h-8"
                            />
                          </td>
                          <td className="h-8 text-center text-xs text-muted-foreground">
                            {calcOvertimeDisplay(record.workedMinutes)}
                          </td>
                          <td className="h-8">
                            <Select
                              value={normalizeStatusOption(attendanceEditForm.attendance)}
                              onValueChange={(value) =>
                                setAttendanceEditForm((prev) =>
                                  prev ? { ...prev, attendance: normalizeStatusOption(value) } : prev
                                )
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VALID_ATTENDANCE_STATUS.map((code) => (
                                  <SelectItem key={code} value={code}>{ATTENDANCE_LABEL[code]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="h-8">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => saveAttendanceRow(record)}
                                aria-label="Save"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={resetAttendanceRowEditor}
                                aria-label="Cancel"
                                className="h-8 w-8 p-0 text-slate-600 hover:text-slate-800"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="h-8">{formatTimeInIndia(record.checkInAt)}</td>
                          <td className="h-8">{formatTimeInIndia(record.checkOutAt)}</td>
                          <td className="h-8">{record.workedDuration || "0m"}</td>
                          <td className="h-8 text-xs text-orange-600 font-medium">{calcOvertimeDisplay(record.workedMinutes)}</td>
                          <td className="h-8">{ATTENDANCE_LABEL[normalizeStatusOption(record.attendance)]}</td>
                          <td className="h-8">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openEmployeeCalendar(record)}
                                aria-label="View attendance calendar"
                                className="h-8 w-8 p-0 text-slate-600 hover:text-slate-800"
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openAttendanceRowEditor(record)}
                                aria-label="Edit"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteAttendanceRow(record)}
                                aria-label="Delete"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {renderedAttendanceRecords.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center text-muted-foreground h-8">
                        {loadingAttendanceHistory ? "Loading attendance history..." : "No employees found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
              </>
            )}
          </div>
        )}

        {activeTab === "adjustments" && (
          <div className="space-y-4" style={{ paddingTop: "var(--master-gap)" }}>
            <div className="space-y-4">
              <div className="form-table-wrapper form-table-wrapper--independent-tl attendance-payroll-table-wrapper attendance-payroll-adjustments-table-wrapper">
                <table className="w-full table-fixed text-sm">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="bg-slate-100 text-center">
                        <span className="inline-flex items-center justify-center">
                          Employee
                          <PayrollFilterMenu
                            options={[...new Set(adjustments.map((a) => a.employee.empName))].sort()}
                            value={adjustmentNameFilter}
                            onChange={setAdjustmentNameFilter}
                          />
                        </span>
                      </th>
                      <th className="bg-slate-100 text-center">Type</th>
                      <th className="bg-slate-100 text-center">Amount</th>
                      <th className="bg-slate-100 text-center">
                        <span className="inline-flex items-center justify-center">
                          Date
                          <PayrollFilterMenu
                            options={[...new Set(adjustments.map((a) => formatDateDDMMYY(a.adjustmentDate) ?? ""))].filter(Boolean).sort()}
                            value={adjustmentDateFilter}
                            onChange={setAdjustmentDateFilter}
                          />
                        </span>
                      </th>
                      <th className="bg-slate-100 text-center">Remarks</th>
                      {!isTechnicianViewer ? <th className="w-24 bg-slate-100 text-center">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody className="[&_td]:text-center">
                    {visibleAdjustments.map((adj) => (
                      <tr key={adj.adjustmentId} className="h-8">
                        <td className="font-medium h-8">{adj.employee.empName}</td>
                        <td className="h-8">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              adj.adjustmentType === "Allowance"
                                ? "bg-green-100 text-green-800"
                                : adj.adjustmentType === "Incentive"
                                  ? "bg-blue-100 text-blue-800"
                                  : adj.adjustmentType === "Deduction"
                                    ? "bg-orange-100 text-orange-800"
                                    : ["PF", "ESI", "Tax"].includes(adj.adjustmentType)
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-red-100 text-red-800"
                            }`}
                          >
                            {adj.adjustmentType}
                          </span>
                        </td>
                        <td className="h-8">₹{adj.amount.toFixed(2)}</td>
                        <td className="h-8">{formatDateDDMMYY(adj.adjustmentDate)}</td>
                        <td className="h-8 text-sm text-muted-foreground">
                          {adj.remarks || "-"}
                        </td>
                        {!isTechnicianViewer ? (
                          <td className="h-8">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditAdjustmentModal(adj)}
                                aria-label="Edit adjustment"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteAdjustment(adj)}
                                aria-label="Delete adjustment"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {visibleAdjustments.length === 0 && (
                      <tr>
                        <td colSpan={isTechnicianViewer ? 6 : 7} className="h-8 text-center text-muted-foreground">
                          {loadingAdjustments
                            ? (isTechnicianViewer ? "Loading payment history..." : "Loading adjustments...")
                            : (isTechnicianViewer ? "No payment history found for this period" : "No adjustments found")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {!isTechnicianViewer ? (
                <div className="shrink-0 mt-[1mm]">
                  <Button
                    type="button"
                    onClick={openNewAdjustmentModal}
                    disabled={isSavingAdjustment}
                    className="global-bottom-btn-add"
                    variant="ghost"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Adjustment
                  </Button>
                </div>
              ) : null}
            </div>

            <Dialog open={isAdjustmentModalOpen} onOpenChange={handleAdjustmentModalOpenChange}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-semibold">
                    {editingAdjustmentId ? "Edit Adjustment" : "Add New Adjustment"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingAdjustmentId ? "Update adjustment details." : "Enter adjustment details to create a new record."}
                  </DialogDescription>
                </DialogHeader>

                <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-1 items-start">
                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                      <Label htmlFor="adjustment-employee-select">Employee</Label>
                      <Select
                        value={selectedAdjustmentEmployee ? String(selectedAdjustmentEmployee.employeeId) : undefined}
                        onValueChange={(value) => {
                          const employee = employees.find((item) => String(item.employeeId) === value) || null
                          setSelectedAdjustmentEmployee(employee)
                        }}
                        disabled={editingAdjustmentId !== null}
                      >
                        <SelectTrigger id="adjustment-employee-select" aria-label="Select employee" className="w-full">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((employee) => (
                            <SelectItem key={employee.employeeId} value={String(employee.employeeId)}>
                              {employee.empName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedAdjustmentEmployee ? (
                        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
                          <div className="font-medium text-slate-900">{selectedAdjustmentEmployee.empName}</div>
                          <div className="text-xs text-muted-foreground">
                            ID: {selectedAdjustmentEmployee.idNumber}
                            {selectedAdjustmentEmployee.designation ? ` • ${selectedAdjustmentEmployee.designation}` : ""}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adjustment-type">Type</Label>
                      <Select
                        value={adjustmentForm.adjustmentType}
                        onValueChange={(value) =>
                          setAdjustmentForm((prev) => ({ ...prev, adjustmentType: value }))
                        }
                      >
                        <SelectTrigger id="adjustment-type" aria-label="Adjustment type" className="cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="z-[70]">
                          <SelectItem value="Allowance">Allowance</SelectItem>
                          <SelectItem value="Advance">Advance</SelectItem>
                          <SelectItem value="Incentive">Incentive</SelectItem>

                          <SelectItem value="PF">PF</SelectItem>
                          <SelectItem value="ESI">ESI</SelectItem>
                          <SelectItem value="Tax">Tax</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adjustment-amount">Amount</Label>
                      <Input
                        id="adjustment-amount"
                        type="number"
                        min={0}
                        placeholder="0.00"
                        value={adjustmentForm.amount}
                        onChange={(event) =>
                          setAdjustmentForm((prev) => ({ ...prev, amount: event.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adjustment-date">Date</Label>
                      <DatePickerInput
                        id="adjustment-date"
                        value={adjustmentForm.adjustmentDate}
                        onChange={(value) =>
                          setAdjustmentForm((prev) => ({ ...prev, adjustmentDate: value }))
                        }
                        format="iso"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                      <Label htmlFor="adjustment-remarks">Remarks</Label>
                      <Textarea
                        id="adjustment-remarks"
                        value={adjustmentForm.remarks}
                        onChange={(event) =>
                          setAdjustmentForm((prev) => ({ ...prev, remarks: event.target.value }))
                        }
                        rows={3}
                        placeholder="Optional remarks"
                      />
                    </div>
                  </div>

                  <div className="sticky-form-actions flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleAdjustmentModalOpenChange(false)}
                      disabled={isSavingAdjustment}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={saveAdjustment}
                      disabled={isSavingAdjustment}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {isSavingAdjustment ? "Saving..." : editingAdjustmentId ? "Update" : "Save"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {activeTab === "payroll" && (
          <div className="space-y-4" style={{ paddingTop: "var(--master-gap)" }}>
            <div className="form-table-wrapper form-table-wrapper--independent-tl attendance-payroll-table-wrapper payroll-table-wrapper">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="bg-slate-100 text-center">#</th>
                    <th className="w-[18%] bg-slate-100 text-center">
                      <span className="inline-flex items-center justify-center">
                        Employee
                        <PayrollFilterMenu
                          options={[...new Set(payrollRecords.map((p) => p.employee.empName))].sort()}
                          value={payrollNameFilter}
                          onChange={setPayrollNameFilter}
                        />
                      </span>
                    </th>
                    <th className="bg-slate-100 text-center">
                      <span className="inline-flex items-center justify-center">
                        Date
                        <PayrollFilterMenu
                          options={[...new Set(payrollRecords.map((p) => formatPayrollDate(p.month, p.year)))]}
                          value={payrollDateFilter}
                          onChange={setPayrollDateFilter}
                        />
                      </span>
                    </th>
                    <th className="bg-slate-100 text-center">Basic Salary</th>
                    <th className="bg-slate-100 text-center">Allowances</th>
                    <th className="bg-slate-100 text-center">Incentives</th>
                    <th className="bg-slate-100 text-center">Advances</th>
                    <th className="bg-slate-100 text-center">Deductions</th>
                    <th className="bg-slate-100 text-center font-bold">Net Salary</th>
                    <th className="w-24 bg-slate-100 text-center">Download</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:text-center">
                  {visiblePayrollRecords.map((payroll, index) => (
                    <tr key={payroll.payrollId} className="h-8">
                      <td className="h-8">{index + 1}</td>
                      <td className="h-8 font-medium">{payroll.employee.empName}</td>
                      <td className="h-8 text-slate-500">{formatPayrollDate(payroll.month, payroll.year)}</td>
                      <td className="h-8">₹{payroll.basicSalary.toFixed(2)}</td>
                      <td className="h-8 text-green-600">
                        +₹{payroll.totalAllowance.toFixed(2)}
                      </td>
                      <td className="h-8 text-blue-600">
                        +₹{payroll.totalIncentive.toFixed(2)}
                      </td>
                      <td className="h-8 text-red-600">
                        -₹{payroll.totalAdvance.toFixed(2)}
                      </td>
                      <td className="h-8 text-orange-600">
                        -₹{(payroll.totalDeduction || 0).toFixed(2)}
                      </td>
                      <td className="h-8 font-bold">₹{payroll.netSalary.toFixed(2)}</td>
                      <td className="h-8">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => printSalarySlip(payroll)}
                          className="gap-1 px-2 py-1 text-blue-600 hover:bg-orange-100 hover:text-orange-600"
                        >
                          <Printer className="h-4 w-4" />
                          Slip
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {visiblePayrollRecords.length === 0 && (
                    <tr>
                      <td colSpan={10} className="h-8 text-center text-muted-foreground">
                        {isTechnicianViewer
                          ? "No payroll generated for this month yet."
                          : "No payroll records found for this month."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {visiblePayrollRecords.length > 0 && (
              <div className="flex justify-end p-4 rounded-lg">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total Net Payable</div>
                  <div className="text-2xl font-bold">
                    ₹
                    {Math.round(visiblePayrollRecords.reduce((sum, p) => sum + p.netSalary, 0)).toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "generate-payroll" && (
          <div className="space-y-4" style={{ paddingTop: "var(--master-gap)" }}>
            {isTechnicianViewer ? (
              <Card className="p-4 text-sm text-muted-foreground">
                Technicians can only view payroll. Generation is available for admin and manager roles.
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="generatePayrollMonth">Month</Label>
                    <Select
                      value={payrollMonth.toString()}
                      onValueChange={(value) => setPayrollMonth(parseInt(value, 10))}
                    >
                      <SelectTrigger id="generatePayrollMonth" className="!h-[33px] !min-h-[33px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                          <SelectItem key={month} value={month.toString()}>
                            {new Date(2000, month - 1).toLocaleString("en-IN", { month: "long" })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="generatePayrollYear">Year</Label>
                    <Select
                      value={payrollYear.toString()}
                      onValueChange={(value) => setPayrollYear(parseInt(value, 10))}
                    >
                      <SelectTrigger id="generatePayrollYear" className="!h-[33px] !min-h-[33px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => currentIndiaYear - i).map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    disabled={generatingPayroll}
                    onClick={() => runPayrollGeneration(payrollMonth, payrollYear, false)}
                  >
                    {generatingPayroll ? "Processing..." : "Generate Payroll"}
                  </Button>
                </div>

                <div className="mt-4">
                  <div className="form-table-wrapper form-table-wrapper--independent-tl attendance-payroll-table-wrapper generate-payroll-table-wrapper">
                  <table className="w-full table-fixed text-sm">
                    <thead className="sticky top-0 z-20">
                      <tr>
                        <th className="bg-slate-100 text-center">#</th>
                        <th className="bg-slate-100 text-center">No. of Employees</th>
                        <th className="bg-slate-100 text-center">Month</th>
                        <th className="bg-slate-100 text-center">Generated Date</th>
                        <th className="bg-slate-100 text-center">Total Amount</th>
                        <th className="bg-slate-100 text-center">Generated By</th>
                        <th className="bg-slate-100 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="[&_td]:text-center">
                      {visiblePayrollHistory.map((row, index) => (
                        <tr key={`${row.year}-${row.month}`} className="h-8 hover:bg-slate-50">
                          <td className="h-8">{index + 1}</td>
                          <td className="h-8">{row.employeeCount}</td>
                          <td className="h-8">
                            {new Date(row.year, row.month - 1, 1).toLocaleString("en-IN", {
                              month: "long",
                              year: "numeric",
                            })}
                          </td>
                          <td className="h-8">
                            {row.generatedAt
                              ? new Date(row.generatedAt).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                          <td className="h-8 font-medium">₹{Number(row.totalAmount || 0).toFixed(2)}</td>
                          <td className="h-8">{row.generatedBy || "System"}</td>
                          <td className="h-8">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={generatingPayroll}
                              className="p-0 text-blue-600 hover:text-blue-700 hover:bg-transparent"
                              onClick={() => runPayrollGeneration(row.month, row.year, true)}
                            >
                              <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                              Regenerate
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {!loadingPayrollHistory && visiblePayrollHistory.length === 0 && (
                        <tr>
                          <td colSpan={7} className="h-8 text-center text-muted-foreground">
                            No payroll generation history found.
                          </td>
                        </tr>
                      )}
                      {loadingPayrollHistory && (
                        <tr>
                          <td colSpan={7} className="h-8 text-center text-muted-foreground">
                            Loading generation history...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "leave-holidays" && !isTechnicianViewer && (
          <AttendancePolicyForm isAdminViewer={isAdminViewer} />
        )}
      </div>
    <Dialog
      open={employeeCalendarDialogOpen}
      onOpenChange={(open) => {
        setEmployeeCalendarDialogOpen(open)
        if (!open) {
          setSelectedCalendarEmployee(null)
          setEmployeeAttendanceCalendarRecords([])
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {selectedCalendarEmployee ? `${selectedCalendarEmployee.empName} Attendance Calendar` : "Attendance Calendar"}
          </DialogTitle>
          <DialogDescription>
            {selectedCalendarEmployee
              ? `${selectedCalendarEmployee.idNumber}${selectedCalendarEmployee.designation ? ` • ${selectedCalendarEmployee.designation}` : ""}`
              : "Monthly attendance view"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">{employeeCalendarMonthLabel}</div>
            <div className="flex items-center gap-2">
              <Select
                value={String(employeeAttendanceCalendarMonth)}
                onValueChange={(value) => setEmployeeAttendanceCalendarMonth(parseInt(value, 10))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <SelectItem key={month} value={String(month)}>
                      {new Date(2000, month - 1, 1).toLocaleString("en-IN", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(employeeAttendanceCalendarYear)}
                onValueChange={(value) => setEmployeeAttendanceCalendarYear(parseInt(value, 10))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, index) => currentIndiaYear - index).map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Full Day</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Half Day</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Partial Day</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Absent</span>
          </div>

          <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div key={label} className="text-center">{label}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {employeeCalendarDays.map((cell) => (
              <div
                key={cell.key}
                className={`h-16 rounded-md border p-2 text-xs ${getCalendarStatusClass(cell.status)}`}
              >
                {cell.day ? (
                  <>
                    <div className="font-semibold">{cell.day}</div>
                    <div className="mt-1 text-[11px]">{cell.status || "-"}</div>
                  </>
                ) : null}
              </div>
            ))}
          </div>

          {loadingEmployeeAttendanceCalendar ? (
            <div className="text-xs text-muted-foreground">Loading attendance calendar...</div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

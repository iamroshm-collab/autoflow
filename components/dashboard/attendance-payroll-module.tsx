"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from '@/components/ui/notify'
import { Printer, Plus, Trash2, Calendar, Edit3, CreditCard, Pencil, Save, X } from "lucide-react"
import { generateSalarySlipPdf } from "@/lib/salary-slip-pdf"
import { DatePickerInput } from "@/components/ui/date-picker-input"
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

const normalizeStatusOption = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase()

  if (normalized === "P" || normalized === "PRESENT") {
    return "P"
  }

  if (
    normalized === "H" ||
    normalized === "HALF DAY" ||
    normalized === "HALF-DAY" ||
    normalized === "HALFDAY"
  ) {
    return "H"
  }

  return "A"
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
  nextAction?: "IN" | "OUT"
  todayRecord?: {
    attendance: string
    checkInAt: string | null
    checkOutAt: string | null
    workedDuration: string
  } | null
}

type AttendancePayrollTabKey = "attendance" | "adjustments" | "payroll"

interface AttendancePayrollModuleProps {
  activeTab?: AttendancePayrollTabKey
  onTabChange?: (tab: AttendancePayrollTabKey) => void
  viewerRole?: "admin" | "manager" | "technician"
  currentEmployeeId?: number | null
}

export function AttendancePayrollModule({
  activeTab: controlledActiveTab,
  onTabChange,
  viewerRole,
  currentEmployeeId,
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
  const [attendanceDate, setAttendanceDate] = useState<string>(todayIndia)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [attendanceCalendarRecords, setAttendanceCalendarRecords] = useState<AttendanceCalendarRecord[]>([])
  const [loadingAttendanceCalendar, setLoadingAttendanceCalendar] = useState(false)
  const [attendanceCalendarMonth, setAttendanceCalendarMonth] = useState(currentIndiaMonth)
  const [attendanceCalendarYear, setAttendanceCalendarYear] = useState(currentIndiaYear)
  const [mobileAttendanceDetails, setMobileAttendanceDetails] = useState<MobileAttendanceDetails | null>(null)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  // Track local (unsaved) attendance edits and saving state
  const [modifiedAttendanceMap, setModifiedAttendanceMap] = useState<Record<number, string>>({})
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [editingAttendanceId, setEditingAttendanceId] = useState<number | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null)
  const [attendanceEditForm, setAttendanceEditForm] = useState<AttendanceEditForm | null>(null)

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
  const [loadingPayroll, setLoadingPayroll] = useState(false)
  const [generatingPayroll, setGeneratingPayroll] = useState(false)

  // Fetch employees on component mount
  useEffect(() => {
    fetchEmployees()
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
      // clear any local unsaved edits when loading from server
      setModifiedAttendanceMap({})
    } catch (error) {
      console.error("Error fetching attendance:", error)
      toast.error("Failed to fetch attendance")
    } finally {
      setLoadingAttendance(false)
    }
  }, [attendanceDate, isTechnicianViewer, currentEmployeeId])

  const fetchAttendanceCalendar = async (month: number, year: number) => {
    if (!Number.isInteger(currentEmployeeId)) {
      return
    }

    setLoadingAttendanceCalendar(true)
    try {
      const params = new URLSearchParams({
        employeeId: String(currentEmployeeId),
        month: String(month),
        year: String(year),
      })
      const response = await fetch(`/api/attendance-payroll/attendance?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch attendance calendar")
      }

      const data = await response.json()
      setAttendanceCalendarRecords(Array.isArray(data?.records) ? data.records : [])
    } catch (error) {
      console.error("Error fetching attendance calendar:", error)
      setAttendanceCalendarRecords([])
      toast.error("Failed to fetch attendance calendar")
    } finally {
      setLoadingAttendanceCalendar(false)
    }
  }

  const fetchMobileAttendanceDetails = async () => {
    if (!Number.isInteger(currentEmployeeId)) {
      setMobileAttendanceDetails(null)
      return
    }

    try {
      const response = await fetch(`/api/mobile-attendance?employeeId=${currentEmployeeId}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to fetch mobile attendance details")
      }
      const data = await response.json()
      setMobileAttendanceDetails(data)
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

      const patchResponse = await fetch("/api/attendance-payroll/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: rowAttendanceId,
          attendanceDate,
          attendance: normalizeStatusOption(attendanceEditForm.attendance),
          checkInTime: attendanceEditForm.checkInTime,
          checkOutTime: attendanceEditForm.checkOutTime,
          workedMinutes: attendanceEditForm.workedMinutes,
        }),
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
    } catch (error) {
      console.error("Error fetching payroll:", error)
      toast.error("Failed to fetch payroll")
    } finally {
      setLoadingPayroll(false)
    }
  }

  const generatePayroll = async () => {
    if (isTechnicianViewer) {
      toast.error("Payroll generation is allowed for admin and manager only")
      return
    }

    setGeneratingPayroll(true)
    try {
      const response = await fetch("/api/attendance-payroll/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: payrollMonth,
          year: payrollYear,
          generatedBy: "System",
        }),
      })

      if (!response.ok) throw new Error("Failed to generate payroll")

      const data = await response.json()
      toast.success(`Payroll generated for ${data.count} employees`)
      
      // Refresh payroll records
      fetchPayroll()
    } catch (error) {
      console.error("Error generating payroll:", error)
      toast.error("Failed to generate payroll")
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

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceCalendarRecord>()
    attendanceCalendarRecords.forEach((record) => {
      map.set(record.date, record)
    })
    return map
  }, [attendanceCalendarRecords])

  const technicianCalendarDays = useMemo(() => {
    const firstDay = new Date(attendanceCalendarYear, attendanceCalendarMonth - 1, 1)
    const daysInMonth = new Date(attendanceCalendarYear, attendanceCalendarMonth, 0).getDate()
    const leading = firstDay.getDay()
    const cells: Array<{ key: string; day: number | null; date: string | null; status: string | null }> = []

    for (let i = 0; i < leading; i += 1) {
      cells.push({ key: `blank-start-${i}`, day: null, date: null, status: null })
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${attendanceCalendarYear}-${String(attendanceCalendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      const status = normalizeStatusOption(attendanceByDate.get(date)?.attendance)
      cells.push({ key: date, day, date, status })
    }

    while (cells.length % 7 !== 0) {
      cells.push({ key: `blank-end-${cells.length}`, day: null, date: null, status: null })
    }

    return cells
  }, [attendanceByDate, attendanceCalendarMonth, attendanceCalendarYear])

  const getCalendarStatusClass = (status: string | null) => {
    if (status === "P") return "bg-emerald-100 text-emerald-800 border-emerald-300"
    if (status === "H") return "bg-amber-100 text-amber-800 border-amber-300"
    if (status === "A") return "bg-rose-100 text-rose-800 border-rose-300"
    return "bg-white text-slate-500 border-slate-200"
  }

  const monthLabel = useMemo(() => {
    return new Date(attendanceCalendarYear, attendanceCalendarMonth - 1, 1).toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    })
  }, [attendanceCalendarMonth, attendanceCalendarYear])

  return (
    <div className="space-y-6">
        {/* Tab Panels (rendered conditionally) */}
        {activeTab === "attendance" && (
          <div className="global-tabs-panel space-y-4">
            {isTechnicianViewer ? (
              <div className="space-y-4">
                {!Number.isInteger(currentEmployeeId) ? (
                  <Card className="p-4 text-sm text-muted-foreground">
                    Your account is not linked to an employee profile yet. Please contact admin.
                  </Card>
                ) : (
                  <>
                    <Card className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">Camera + Geofence Attendance</h3>
                          <p className="text-xs text-muted-foreground">
                            Use mobile attendance to check-in/check-out with live camera verification.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => window.open("/mobile-attendance", "_blank", "noopener,noreferrer")}
                        >
                          Mark Attendance
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-md border p-3 bg-slate-50">
                          <div className="text-xs text-muted-foreground">Next Action</div>
                          <div className="text-sm font-semibold">{mobileAttendanceDetails?.nextAction || "IN"}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-slate-50">
                          <div className="text-xs text-muted-foreground">Check In</div>
                          <div className="text-sm font-semibold">{formatTimeInIndia(mobileAttendanceDetails?.todayRecord?.checkInAt)}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-slate-50">
                          <div className="text-xs text-muted-foreground">Check Out</div>
                          <div className="text-sm font-semibold">{formatTimeInIndia(mobileAttendanceDetails?.todayRecord?.checkOutAt)}</div>
                        </div>
                      </div>
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
                        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Present</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Half Day</span>
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
                                <div className="mt-1 text-[11px]">{cell.status || "-"}</div>
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
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
              <div className="flex items-center gap-2">
                <DatePickerInput
                  id="attendanceDate"
                  value={attendanceDate}
                  onChange={handleAttendanceDateChange}
                  format="iso"
                  placeholder="dd-mm-yy"
                  className="w-64 border rounded-md px-3 py-2 bg-white focus:ring-0 mx-auto text-center"
                />
              </div>

              <div className="text-sm text-muted-foreground">
                Employees must mark attendance from their phone at /mobile-attendance.
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="[&_th]:text-center">
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>ID Number</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Worked Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_td]:text-center">
                  {attendanceRecords.map((record, index) => (
                    <TableRow key={record.employeeId} className="h-8">
                      <TableCell className="h-8">{index + 1}</TableCell>
                      <TableCell className="font-medium h-8">{record.empName}</TableCell>
                      <TableCell className="h-8">{record.idNumber}</TableCell>
                      <TableCell className="h-8">{record.designation || "N/A"}</TableCell>
                      {editingEmployeeId === record.employeeId && attendanceEditForm ? (
                        <>
                          <TableCell className="h-8">
                            <Input
                              type="time"
                              value={attendanceEditForm.checkInTime}
                              onChange={(e) =>
                                setAttendanceEditForm((prev) =>
                                  prev ? { ...prev, checkInTime: e.target.value } : prev
                                )
                              }
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="h-8">
                            <Input
                              type="time"
                              value={attendanceEditForm.checkOutTime}
                              onChange={(e) =>
                                setAttendanceEditForm((prev) =>
                                  prev ? { ...prev, checkOutTime: e.target.value } : prev
                                )
                              }
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="h-8">
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
                          </TableCell>
                          <TableCell className="h-8">
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
                                <SelectItem value="P">P</SelectItem>
                                <SelectItem value="H">H</SelectItem>
                                <SelectItem value="A">A</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="h-8">
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
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="h-8">{formatTimeInIndia(record.checkInAt)}</TableCell>
                          <TableCell className="h-8">{formatTimeInIndia(record.checkOutAt)}</TableCell>
                          <TableCell className="h-8">{record.workedDuration || "0m"}</TableCell>
                          <TableCell className="h-8">{normalizeStatusOption(record.attendance)}</TableCell>
                          <TableCell className="h-8">
                            <div className="flex items-center justify-center gap-2">
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
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {attendanceRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground h-8">
                        No employees found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
              </>
            )}
          </div>
        )}

        {activeTab === "adjustments" && (
          <div className="global-tabs-panel space-y-4">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h3 className="text-lg font-semibold">
                  {isTechnicianViewer ? "Payment History" : "Recent Adjustments"}
                </h3>
                {!isTechnicianViewer ? (
                  <div className="w-80 max-w-full">
                    <Select value={adjustmentFilterEmployeeId} onValueChange={setAdjustmentFilterEmployeeId}>
                      <SelectTrigger aria-label="Filter adjustments by employee" className="w-full">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent className="dropdown-scroll-modal">
                        <SelectItem value="all">All Employees</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.employeeId} value={String(employee.employeeId)}>
                            {employee.empName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Deduction</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Remarks</TableHead>
                      {!isTechnicianViewer ? <TableHead className="w-24">Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdjustments.map((adj) => (
                      <TableRow key={adj.adjustmentId}>
                        <TableCell className="font-medium">{adj.employee.empName}</TableCell>
                        <TableCell>{adj.employee.idNumber}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              adj.adjustmentType === "Allowance"
                                ? "bg-green-100 text-green-800"
                                : adj.adjustmentType === "Incentive"
                                  ? "bg-blue-100 text-blue-800"
                                  : adj.adjustmentType === "Deduction"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                          >
                            {adj.adjustmentType}
                          </span>
                        </TableCell>
                        <TableCell>₹{adj.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-red-600">
                          {adj.adjustmentType === "Deduction" ? `-₹${adj.amount.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell>{formatDateDDMMYY(adj.adjustmentDate)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {adj.remarks || "-"}
                        </TableCell>
                        {!isTechnicianViewer ? (
                          <TableCell>
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
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                    {filteredAdjustments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isTechnicianViewer ? 7 : 8} className="text-center text-muted-foreground">
                          {loadingAdjustments
                            ? (isTechnicianViewer ? "Loading payment history..." : "Loading adjustments...")
                            : (isTechnicianViewer ? "No payment history found for this period" : "No adjustments found")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {!isTechnicianViewer ? (
                <div className="sticky-form-actions flex justify-center mt-6">
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
                        <SelectContent className="dropdown-scroll-modal">
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
                        <SelectContent position="popper" sideOffset={4} className="z-[70] dropdown-scroll-modal">
                          <SelectItem value="Allowance">Allowance</SelectItem>
                          <SelectItem value="Advance">Advance</SelectItem>
                          <SelectItem value="Incentive">Incentive</SelectItem>
                          <SelectItem value="Deduction">Deduction</SelectItem>
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
          <div className="global-tabs-panel space-y-4">
            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="payrollMonth" className="text-center">Month:</Label>
                  <Select
                    value={payrollMonth.toString()}
                    onValueChange={(value) => setPayrollMonth(parseInt(value))}
                  >
                    <SelectTrigger id="payrollMonth" className="w-40 mx-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {new Date(2000, month - 1).toLocaleDateString("en-US", {
                            month: "long",
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="payrollYear" className="text-center">Year:</Label>
                  <Select
                    value={payrollYear.toString()}
                    onValueChange={(value) => setPayrollYear(parseInt(value))}
                  >
                    <SelectTrigger id="payrollYear" className="w-32 mx-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => currentIndiaYear - i).map(
                        (year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!isTechnicianViewer ? (
                <Button onClick={generatePayroll} disabled={generatingPayroll} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {generatingPayroll ? "Generating..." : "Generate Monthly Payroll"}
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">Download is available after manager/admin generates payroll.</div>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>P</TableHead>
                    <TableHead>H</TableHead>
                    <TableHead>L</TableHead>
                    <TableHead>A</TableHead>
                    <TableHead>Basic Salary</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Incentives</TableHead>
                    <TableHead>Advances</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead className="font-bold">Net Salary</TableHead>
                    <TableHead className="w-24">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRecords.map((payroll, index) => (
                    <TableRow key={payroll.payrollId}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{payroll.employee.empName}</TableCell>
                      <TableCell>{payroll.employee.idNumber}</TableCell>
                      <TableCell>{payroll.totalPresent}</TableCell>
                      <TableCell>{payroll.totalHalfDay}</TableCell>
                      <TableCell>{payroll.totalLeave}</TableCell>
                      <TableCell>{payroll.totalAbsent}</TableCell>
                      <TableCell>₹{payroll.basicSalary.toFixed(2)}</TableCell>
                      <TableCell className="text-green-600">
                        +₹{payroll.totalAllowance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-blue-600">
                        +₹{payroll.totalIncentive.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-red-600">
                        -₹{payroll.totalAdvance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-orange-600">
                        -₹{(payroll.totalDeduction || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-bold">₹{payroll.netSalary.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => printSalarySlip(payroll)}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Slip
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {payrollRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center text-muted-foreground">
                        {isTechnicianViewer
                          ? "No payroll generated for this month yet."
                          : "No payroll records found. Click \"Generate Monthly Payroll\" to create records."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {payrollRecords.length > 0 && (
              <div className="flex justify-end p-4 bg-muted/50 rounded-lg">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total Net Payable</div>
                  <div className="text-2xl font-bold">
                    ₹
                    {payrollRecords
                      .reduce((sum, p) => sum + p.netSalary, 0)
                      .toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  )
}

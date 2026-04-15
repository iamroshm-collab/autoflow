"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { toast } from '@/components/ui/notify'
import { successAction, errorAction } from "@/lib/action-feedback"
import { getMobileValidationMessage, normalizeMobileNumber } from "@/lib/mobile-validation"
import { Plus } from "lucide-react"
import { ServiceOverviewChart } from "@/components/dashboard/service-overview-chart"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePickerInput } from "@/components/ui/date-picker-input"
import { composeAddress, parseAddress } from "@/lib/address-utils"
import { GARAGE_DEPARTMENTS, getDesignationsForDepartment } from "@/lib/garage-departments"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface EmployeeStats {
  totalJobsDone: number
  vehiclesAttended: number
  breakdownPickups: number
  avgTurnaround: number
  totalIncome: number
  serviceOverview: Array<{ month: string; services: number; income: number; vehicles: number; avgTurnaround: number }>
  attendanceRecords: Array<{
    date: string
    attendance: string
    salaryAdvance: number
    incentive: number
    allowance: number
    workedMinutes: number | null
  }>
}

interface Employee {
  employeeId: number
  empName: string
  idNumber: string
  mobile: string
  address: string | null
  department: string | null
  designation: string | null
  salaryPerday: number
  startDate: string | null
  endDate: string | null
  attendance: string | null
  attendanceDate: string | null
  facePhotoUrl: string | null
  facePhotoUpdatedAt: string | null
  isAttendanceEligible: boolean
  isTechnician: boolean
  isArchived: boolean
  monthlySalary?: number | null
  workingDaysInMonth?: number | null
  perDaySalary?: number | null
  basicSalary?: number | null
  grossSalary?: number | null
  houseRentAllowance?: number | null
  dearnessAllowance?: number | null
  conveyanceAllowance?: number | null
  medicalAllowance?: number | null
  specialAllowance?: number | null
  travelAllowance?: number | null
  internetAllowance?: number | null
  otherAllowance?: number | null
  pfApplicable?: number | null
  esiApplicable?: number | null
  professionalTaxApplicable?: number | null
}

type EmployeeWithStatsResponse = Employee & { stats?: EmployeeStats }

interface EmployeeFormState {
  empName: string
  idNumber: string
  mobile: string
  addressLine1: string
  addressLine2: string
  city: string
  district: string
  state: string
  postalCode: string
  department: string
  designation: string
  salaryPerday: string
  monthlySalary: string
  workingDaysInMonth: string
  perDaySalary: string
  basicSalary: string
  grossSalary: string
  houseRentAllowance: string
  dearnessAllowance: string
  conveyanceAllowance: string
  medicalAllowance: string
  specialAllowance: string
  travelAllowance: string
  internetAllowance: string
  otherAllowance: string
  pfApplicable: string
  esiApplicable: string
  professionalTaxApplicable: string
  salaryType: "PerDay" | "Monthly"
  startDate: string
  endDate: string
  attendance: string
  attendanceDate: string
  facePhotoUrl: string
  isAttendanceEligible: boolean
  isTechnician: boolean
  deregisterDevice: boolean
}

const defaultForm: EmployeeFormState = {
  empName: "",
  idNumber: "",
  mobile: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  postalCode: "",
  department: "",
  designation: "",
  salaryPerday: "",
  monthlySalary: "",
  workingDaysInMonth: "26",
  perDaySalary: "",
  basicSalary: "",
  grossSalary: "",
  houseRentAllowance: "",
  dearnessAllowance: "",
  conveyanceAllowance: "",
  medicalAllowance: "",
  specialAllowance: "",
  travelAllowance: "",
  internetAllowance: "",
  otherAllowance: "",
  pfApplicable: "0",
  esiApplicable: "0",
  professionalTaxApplicable: "0",
  salaryType: "PerDay",
  startDate: "",
  endDate: "",
  attendance: "Present",
  attendanceDate: "",
  facePhotoUrl: "",
  isAttendanceEligible: true,
  isTechnician: false,
  deregisterDevice: false,
}

const toDateInput = (value: string | null) => {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

const LAST_EMPLOYEE_STORAGE_KEY = "employee:lastViewedEmployeeId"

interface EmployeeMasterFormProps {
  searchTerm?: string
  selectedEmployeeId?: number | null
  onSelectedEmployeeHandled?: () => void
  onRecordsCountChange?: (count: number) => void
  onFormActiveChange?: (active: boolean) => void
  initialViewMode?: "form"
}

export function EmployeeMasterForm({
  searchTerm = "",
  selectedEmployeeId,
  onSelectedEmployeeHandled,
  onRecordsCountChange,
  onFormActiveChange,
  initialViewMode = "form",
}: EmployeeMasterFormProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState(searchTerm)
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null)
  const [form, setForm] = useState<EmployeeFormState>(defaultForm)
  const [viewMode, setViewMode] = useState<"list" | "form">("form")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [modalSuccessMessage, setModalSuccessMessage] = useState("")
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(null)
  const [statsEmployeeName, setStatsEmployeeName] = useState("")
  const [statsLoading, setStatsLoading] = useState(false)
  const [isOpeningEmployee, setIsOpeningEmployee] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [chartFilterMode, setChartFilterMode] = useState<"month" | "range">("month")
  const [chartFilterMonth, setChartFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [chartFilterDateFrom, setChartFilterDateFrom] = useState("")
  const [chartFilterDateTo, setChartFilterDateTo] = useState("")
  const [chartMetric, setChartMetric] = useState<"jobcards" | "turnaround" | "earnings">("jobcards")
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const hasAutoOpenedInitialEmployeeRef = useRef(false)
  const isAdminDesignation = form.designation.trim().toLowerCase().includes("admin")

  const getLastViewedEmployeeId = useCallback(() => {
    if (typeof window === "undefined") return null
    const raw = window.localStorage.getItem(LAST_EMPLOYEE_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }, [])

  const setLastViewedEmployeeId = useCallback((employeeId: number | null) => {
    if (typeof window === "undefined") return
    if (employeeId && Number.isInteger(employeeId) && employeeId > 0) {
      window.localStorage.setItem(LAST_EMPLOYEE_STORAGE_KEY, String(employeeId))
      return
    }
    window.localStorage.removeItem(LAST_EMPLOYEE_STORAGE_KEY)
  }, [])

  const loadEmployees = async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const response = await fetch(`/api/employees?search=${encodeURIComponent(search)}`)
      console.debug("[EmployeeMasterForm] GET /api/employees", response.status, response.ok)
      const data = await response.json()

      if (!response.ok) {
        console.debug("[EmployeeMasterForm] GET /api/employees error payload:", data)
        throw new Error(data.error || "Failed to fetch employees")
      }

      console.debug("[EmployeeMasterForm] employees loaded:", Array.isArray(data) ? data.length : 0)
      setEmployees(Array.isArray(data) ? data : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("[EmployeeMasterForm] loadEmployees error:", message)
      setFetchError(message)
      errorAction(message || "Failed to fetch employees")
      setEmployees([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [search])

  useEffect(() => {
    setSearch(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    if (!selectedEmployeeId) {
      return
    }

    setIsOpeningEmployee(true)

    let isCancelled = false

    const loadSelectedEmployee = async () => {
      try {
        const existingEmployee = employees.find((item) => item.employeeId === selectedEmployeeId)

        if (existingEmployee) {
          if (!isCancelled) {
            await loadEmployeeIntoForm(existingEmployee)
          }
          return
        }

        const response = await fetch(`/api/employees/${selectedEmployeeId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch employee")
        }

        if (!isCancelled) {
          await loadEmployeeIntoForm(data as Employee)
        }
      } catch (error) {
        if (!isCancelled) {
          errorAction(error instanceof Error ? error.message : "Failed to fetch employee")
        }
      } finally {
        if (!isCancelled) {
          setIsOpeningEmployee(false)
          onSelectedEmployeeHandled?.()
        }
      }
    }

    void loadSelectedEmployee()

    return () => {
      isCancelled = true
    }
  }, [employees, onSelectedEmployeeHandled, selectedEmployeeId])

  useEffect(() => {
    if (isAdminDesignation && form.isAttendanceEligible) {
      setForm((prev) => ({ ...prev, isAttendanceEligible: false }))
    }
  }, [form.isAttendanceEligible, isAdminDesignation])

  useEffect(() => {
    onRecordsCountChange?.(employees.length)
  }, [employees.length, onRecordsCountChange])

  useEffect(() => {
    if (hasAutoOpenedInitialEmployeeRef.current) return
    if (selectedEmployeeId) return
    if (editingEmployeeId) return
    if (isLoading) return

    hasAutoOpenedInitialEmployeeRef.current = true

    const openInitialEmployee = async () => {
      const lastViewedEmployeeId = getLastViewedEmployeeId()

      if (lastViewedEmployeeId) {
        const rememberedEmployee = employees.find((item) => item.employeeId === lastViewedEmployeeId)
        if (rememberedEmployee) {
          await loadEmployeeIntoForm(rememberedEmployee)
          return
        }

        try {
          const response = await fetch(`/api/employees/${lastViewedEmployeeId}`)
          const data = await response.json()
          if (response.ok) {
            await loadEmployeeIntoForm(data as Employee)
            return
          }
        } catch {
          // Fall back to the first available employee below.
        }

        setLastViewedEmployeeId(null)
      }

      if (employees.length > 0) {
        await loadEmployeeIntoForm(employees[0])
        return
      }

      onFormActiveChange?.(true)
    }

    void openInitialEmployee()
  }, [
    editingEmployeeId,
    employees,
    getLastViewedEmployeeId,
    isLoading,
    onFormActiveChange,
    selectedEmployeeId,
    setLastViewedEmployeeId,
  ])

  // Auto-calculate gross salary = basic + all allowances
  useEffect(() => {
    const gross = [
      form.basicSalary,
      form.houseRentAllowance,
      form.dearnessAllowance,
      form.conveyanceAllowance,
      form.medicalAllowance,
      form.specialAllowance,
      form.travelAllowance,
      form.internetAllowance,
      form.otherAllowance,
    ].reduce((sum, v) => sum + (Number(v) || 0), 0)
    setForm((prev) => ({ ...prev, grossSalary: String(gross) }))
  }, [
    form.basicSalary,
    form.houseRentAllowance,
    form.dearnessAllowance,
    form.conveyanceAllowance,
    form.medicalAllowance,
    form.specialAllowance,
    form.travelAllowance,
    form.internetAllowance,
    form.otherAllowance,
  ])

  const loadEmployeeStats = async (empId: number): Promise<EmployeeStats | null> => {
    setStatsLoading(true)
    setEmployeeStats(null)
    try {
      const res = await fetch(`/api/employees/${empId}/stats`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load stats")
      setEmployeeStats(data as EmployeeStats)
      return data as EmployeeStats
    } catch {
      setEmployeeStats(null)
      return null
    } finally {
      setStatsLoading(false)
    }
  }

  const loadEmployeeIntoForm = async (employee: Employee) => {
    setIsOpeningEmployee(true)
    setLastViewedEmployeeId(employee.employeeId)
    setStatsEmployeeName(employee.empName || "Employee")
    const toFormState = (target: Employee): EmployeeFormState => {
      const parsedAddress = parseAddress(target.address)
      return {
        empName: target.empName || "",
        idNumber: target.idNumber || "",
        mobile: target.mobile || "",
        addressLine1: parsedAddress.line1 || "",
        addressLine2: parsedAddress.line2 || "",
        city: parsedAddress.city || "",
        district: parsedAddress.district || "",
        state: parsedAddress.state || "",
        postalCode: parsedAddress.postalCode || "",
        department: (target as any).department || "",
        designation: target.designation || "",
        salaryPerday: String(target.salaryPerday || 0),
        monthlySalary: String(target.monthlySalary || 0),
        workingDaysInMonth: String(target.workingDaysInMonth || 26),
        perDaySalary: String(target.perDaySalary || target.salaryPerday || 0),
        basicSalary: String(target.basicSalary || 0),
        grossSalary: String(target.grossSalary || 0),
        houseRentAllowance: String(target.houseRentAllowance || 0),
        dearnessAllowance: String(target.dearnessAllowance || 0),
        conveyanceAllowance: String(target.conveyanceAllowance || 0),
        medicalAllowance: String(target.medicalAllowance || 0),
        specialAllowance: String(target.specialAllowance || 0),
        travelAllowance: String(target.travelAllowance || 0),
        internetAllowance: String(target.internetAllowance || 0),
        otherAllowance: String(target.otherAllowance || 0),
        pfApplicable: String(Number(target.pfApplicable) || 0),
        esiApplicable: String(Number(target.esiApplicable) || 0),
        professionalTaxApplicable: String(Number(target.professionalTaxApplicable) || 0),
        salaryType: Number(target.monthlySalary || 0) > 0 ? "Monthly" : "PerDay",
        startDate: toDateInput(target.startDate),
        endDate: toDateInput(target.endDate),
        attendance: target.attendance || "Present",
        attendanceDate: toDateInput(target.attendanceDate),
        facePhotoUrl: target.facePhotoUrl || "",
        isAttendanceEligible: target.isAttendanceEligible !== false,
        isTechnician: Boolean(target.isTechnician),
        deregisterDevice: false,
      }
    }

    let resolvedEmployee: Employee = employee
    let resolvedStats: EmployeeStats | null = null

    try {
      setStatsLoading(true)
      setEmployeeStats(null)
      const response = await fetch(`/api/employees/${employee.employeeId}?includeStats=1`)
      const data = (await response.json()) as EmployeeWithStatsResponse

      if (!response.ok) {
        throw new Error((data as any)?.error || "Failed to load employee details")
      }

      resolvedEmployee = data
      resolvedStats = data.stats || null
    } catch {
      resolvedStats = await loadEmployeeStats(employee.employeeId)
    } finally {
      setStatsLoading(false)
    }

    const nextForm = toFormState(resolvedEmployee)
    setStatsEmployeeName(resolvedEmployee.empName || "Employee")
    if (resolvedStats) {
      setEmployeeStats(resolvedStats)
    }
    if (!resolvedStats) {
      setEmployeeStats(null)
    }

    setModalSuccessMessage("")
    setViewMode("form")
    onFormActiveChange?.(true)
    try {
      setEditingEmployeeId(resolvedEmployee.employeeId)
      setForm(nextForm)
    } finally {
      setIsOpeningEmployee(false)
    }
  }

  const handleAddNew = useCallback(() => {
    setEditingEmployeeId(null)
    setForm(defaultForm)
    setEmployeeStats(null)
    setModalSuccessMessage("")
    setViewMode("form")
    onFormActiveChange?.(true)
  }, [onFormActiveChange])

  const handleSave = useCallback(async () => {
    if (!form.empName.trim() || !form.idNumber.trim() || !form.mobile.trim()) {
      toast.error("EmpName, IDNumber, and Mobile are required")
      return
    }

    const mobileError = getMobileValidationMessage(form.mobile, "Employee mobile number")
    if (mobileError) {
      toast.error(mobileError)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        empName: form.empName.trim(),
        idNumber: form.idNumber.trim(),
        mobile: normalizeMobileNumber(form.mobile),
        address: composeAddress({
          line1: form.addressLine1,
          line2: form.addressLine2,
          city: form.city,
          district: form.district,
          state: form.state,
          postalCode: form.postalCode,
        }),
        department: form.department.trim() || null,
        designation: form.designation.trim(),
        salaryPerday: form.salaryType === "PerDay" ? Number(form.basicSalary || 0) : 0,
        perDaySalary: form.salaryType === "PerDay" ? Number(form.basicSalary || 0) : 0,
        monthlySalary: form.salaryType === "Monthly" ? Number(form.grossSalary || 0) : 0,
        workingDaysInMonth: Number(form.workingDaysInMonth || 26),
        basicSalary: Number(form.basicSalary || 0),
        grossSalary: Number(form.grossSalary || 0),
        houseRentAllowance: Number(form.houseRentAllowance || 0),
        dearnessAllowance: Number(form.dearnessAllowance || 0),
        conveyanceAllowance: Number(form.conveyanceAllowance || 0),
        medicalAllowance: Number(form.medicalAllowance || 0),
        specialAllowance: Number(form.specialAllowance || 0),
        travelAllowance: Number(form.travelAllowance || 0),
        internetAllowance: Number(form.internetAllowance || 0),
        otherAllowance: Number(form.otherAllowance || 0),
        pfApplicable: parseFloat(form.pfApplicable) || 0,
        esiApplicable: parseFloat(form.esiApplicable) || 0,
        professionalTaxApplicable: parseFloat(form.professionalTaxApplicable) || 0,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        attendance: form.attendance || null,
        attendanceDate: form.attendanceDate || null,
        facePhotoUrl: form.facePhotoUrl || null,
        isAttendanceEligible: form.isAttendanceEligible,
        isTechnician: form.isTechnician,
        deregisterDevice: form.deregisterDevice,
      }

      const url = editingEmployeeId ? `/api/employees/${editingEmployeeId}` : "/api/employees"
      const method = editingEmployeeId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save employee")
      }

      successAction(editingEmployeeId ? "Employee updated" : "Employee created")
      await loadEmployees()

      if (data?.employeeId) {
        const updated = data as Employee
        setLastViewedEmployeeId(updated.employeeId)
        setStatsEmployeeName(updated.empName || "Employee")
        setEditingEmployeeId(updated.employeeId)
        const parsedAddress = parseAddress(updated.address)
        setForm({
          empName: updated.empName || "",
          idNumber: updated.idNumber || "",
          mobile: updated.mobile || "",
          addressLine1: parsedAddress.line1 || "",
          addressLine2: parsedAddress.line2 || "",
          city: parsedAddress.city || "",
          district: parsedAddress.district || "",
          state: parsedAddress.state || "",
          postalCode: parsedAddress.postalCode || "",
          department: (updated as any).department || "",
          designation: updated.designation || "",
          salaryPerday: String(updated.salaryPerday || 0),
          monthlySalary: String(updated.monthlySalary || 0),
          workingDaysInMonth: String(updated.workingDaysInMonth || 26),
          perDaySalary: String(updated.perDaySalary || updated.salaryPerday || 0),
          basicSalary: String(updated.basicSalary || 0),
          grossSalary: String(updated.grossSalary || 0),
          houseRentAllowance: String(updated.houseRentAllowance || 0),
          dearnessAllowance: String(updated.dearnessAllowance || 0),
          conveyanceAllowance: String(updated.conveyanceAllowance || 0),
          medicalAllowance: String(updated.medicalAllowance || 0),
          specialAllowance: String(updated.specialAllowance || 0),
          travelAllowance: String(updated.travelAllowance || 0),
          internetAllowance: String(updated.internetAllowance || 0),
          otherAllowance: String(updated.otherAllowance || 0),
          pfApplicable: String(Number(updated.pfApplicable) || 0),
          esiApplicable: String(Number(updated.esiApplicable) || 0),
          professionalTaxApplicable: String(Number(updated.professionalTaxApplicable) || 0),
          salaryType: Number(updated.monthlySalary || 0) > 0 ? "Monthly" : "PerDay",
          startDate: toDateInput(updated.startDate),
          endDate: toDateInput(updated.endDate),
          attendance: updated.attendance || "Present",
          attendanceDate: toDateInput(updated.attendanceDate),
          facePhotoUrl: updated.facePhotoUrl || "",
          isAttendanceEligible: updated.isAttendanceEligible !== false,
          isTechnician: Boolean(updated.isTechnician),
          deregisterDevice: false,
        })
      }

      setModalSuccessMessage(editingEmployeeId ? "Employee details updated" : "Employee created successfully")
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to save employee")
    } finally {
      setIsSaving(false)
    }
  }, [defaultForm, editingEmployeeId, form, loadEmployees, setLastViewedEmployeeId])

  const handleArchive = useCallback(async () => {
    if (!editingEmployeeId) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/employees/${editingEmployeeId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to archive employee")
      }

      successAction("Employee archived safely")
      if (getLastViewedEmployeeId() === editingEmployeeId) {
        setLastViewedEmployeeId(null)
        setStatsEmployeeName("")
      }
      setViewMode("form")
      setEditingEmployeeId(null)
      setForm(defaultForm)
      setEmployeeStats(null)
      setModalSuccessMessage("")
      onFormActiveChange?.(true)
      await loadEmployees()
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to archive employee")
    } finally {
      setIsSaving(false)
    }
  }, [editingEmployeeId, getLastViewedEmployeeId, loadEmployees, onFormActiveChange, setLastViewedEmployeeId])

  const handleDeleteFromList = useCallback(async (employeeId: number) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to archive employee")
      }

      successAction("Employee archived safely")
      if (getLastViewedEmployeeId() === employeeId) {
        setLastViewedEmployeeId(null)
        setStatsEmployeeName("")
      }
      if (editingEmployeeId === employeeId) {
        setEditingEmployeeId(null)
        setForm(defaultForm)
        setModalSuccessMessage("")
        setEmployeeStats(null)
        setViewMode("form")
        onFormActiveChange?.(true)
      }
      await loadEmployees()
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to archive employee")
    } finally {
      setIsSaving(false)
    }
  }, [defaultForm, editingEmployeeId, getLastViewedEmployeeId, loadEmployees, onFormActiveChange, setLastViewedEmployeeId])


  const handleBackToList = useCallback(() => {
    setViewMode("form")
    setEditingEmployeeId(null)
    setForm(defaultForm)
    setModalSuccessMessage("")
    onFormActiveChange?.(true)
  }, [defaultForm, onFormActiveChange])

  // Custom event listeners for bottom-bar buttons
  useEffect(() => {
    const onAddNew = () => {
      setEditingEmployeeId(null)
      setForm(defaultForm)
      setEmployeeStats(null)
      setModalSuccessMessage("")
      setViewMode("form")
      onFormActiveChange?.(true)
    }
    const onSave = () => void handleSave()
    const onArchive = () => void handleArchive()

    window.addEventListener("employee:addNew", onAddNew)
    window.addEventListener("employee:save", onSave)
    window.addEventListener("employee:archive", onArchive)

    return () => {
      window.removeEventListener("employee:addNew", onAddNew)
      window.removeEventListener("employee:save", onSave)
      window.removeEventListener("employee:archive", onArchive)
    }
  }, [defaultForm, handleArchive, handleSave, onFormActiveChange])

  const renderEmployeeSummaryHeader = () => {
    if (!employeeStats) return null

    const allOverview = employeeStats.serviceOverview
    const [cfYear, cfMonth] = chartFilterMonth.split("-").map(Number)

    const filteredOverview = (() => {
      if (chartFilterMode === "month") {
        return allOverview.filter((item) => {
          const parts = item.month.split(" ")
          const d = new Date(`${parts[0]} 1, ${parts[1]}`)
          return d.getFullYear() === cfYear && d.getMonth() + 1 === cfMonth
        })
      }

      const fromD = chartFilterDateFrom ? new Date(chartFilterDateFrom) : null
      const toD = chartFilterDateTo ? new Date(chartFilterDateTo) : null
      if (!fromD && !toD) return allOverview

      return allOverview.filter((item) => {
        const parts = item.month.split(" ")
        const d = new Date(`${parts[0]} 1, ${parts[1]}`)
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        if (fromD && monthEnd < fromD) return false
        if (toD && d > toD) return false
        return true
      })
    })()

    const totalJobs = filteredOverview.reduce((sum, item) => sum + item.services, 0)
    const income = filteredOverview.reduce((sum, item) => sum + item.income, 0)
    const vehicles = filteredOverview.reduce((sum, item) => sum + item.vehicles, 0)
    const turnaroundMonths = filteredOverview.filter((item) => item.avgTurnaround > 0)
    const averageTurnaround = turnaroundMonths.length > 0
      ? Math.round(turnaroundMonths.reduce((sum, item) => sum + item.avgTurnaround, 0) / turnaroundMonths.length)
      : 0

    const metricLabels: Record<string, string> = {
      jobcards: "Job Cards Done",
      turnaround: "Avg Turnaround (mins)",
      earnings: "Earnings (₹)",
    }

    const chartData = filteredOverview.map((item) => ({
      month: item.month,
      services:
        chartMetric === "jobcards" ? item.services
        : chartMetric === "turnaround" ? item.avgTurnaround
        : Math.round(item.income),
    }))

    return (
      <div className="mb-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Employee performance snapshot</h3>
            <p className="text-xs text-muted-foreground">Showing analytics for {statsEmployeeName || "the last opened employee"}.</p>
          </div>
          {statsLoading ? <span className="text-xs text-muted-foreground">Refreshing...</span> : null}
        </div>

        <div className="grid grid-cols-1 gap-[1mm] sm:grid-cols-3 xl:grid-cols-5">
          <div className="dashboard-card flex items-center gap-3 p-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 shrink-0">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 7h18M3 12h18M3 17h18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-muted-foreground truncate">Total Job Cards</span>
              <span className="text-xl font-heading font-bold text-card-foreground">{totalJobs.toLocaleString()}</span>
            </div>
          </div>
          <div className="dashboard-card flex items-center gap-3 p-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 shrink-0">
              <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 8v4l3 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" strokeWidth="1.5"/></svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-muted-foreground truncate">Vehicles Attended</span>
              <span className="text-xl font-heading font-bold text-card-foreground">{vehicles.toLocaleString()}</span>
            </div>
          </div>
          <div className="dashboard-card flex items-center gap-3 p-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 shrink-0">
              <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17l4-8 4 4 4-6 4 10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-muted-foreground truncate">Breakdown Pickups</span>
              <span className="text-xl font-heading font-bold text-card-foreground">{employeeStats.breakdownPickups.toLocaleString()}</span>
            </div>
          </div>
          <div className="dashboard-card flex items-center gap-3 p-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 shrink-0">
              <svg className="w-5 h-5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 6v6l4 2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" strokeWidth="1.5"/></svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-muted-foreground truncate">Avg Turnaround</span>
              <span className="text-xl font-heading font-bold text-card-foreground">{averageTurnaround}<span className="text-sm font-normal ml-0.5">m</span></span>
            </div>
          </div>
          <div className="dashboard-card flex items-center gap-3 p-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 shrink-0">
              <svg className="w-5 h-5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-muted-foreground truncate">Total Income</span>
              <span className="text-xl font-heading font-bold text-card-foreground">₹{income.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="dashboard-card p-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs shrink-0">
              <button
                onClick={() => setChartFilterMode("month")}
                className={`px-3 py-1.5 font-medium transition-colors ${chartFilterMode === "month" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >Month</button>
              <button
                onClick={() => setChartFilterMode("range")}
                className={`px-3 py-1.5 font-medium transition-colors ${chartFilterMode === "range" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >Date Range</button>
            </div>

            {chartFilterMode === "month" ? (
              <div className="flex items-center gap-1 text-xs shrink-0">
                <button
                  onClick={() => {
                    const d = new Date(cfYear, cfMonth - 2, 1)
                    setChartFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                >‹</button>
                <span className="font-medium text-slate-700 w-28 text-center">
                  {new Date(cfYear, cfMonth - 1, 1).toLocaleString("en", { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={() => {
                    const d = new Date(cfYear, cfMonth, 1)
                    setChartFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                >›</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={chartFilterDateFrom}
                  onChange={(e) => setChartFilterDateFrom(e.target.value)}
                  className="h-7 rounded border border-slate-200 px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <span className="text-slate-400">—</span>
                <input
                  type="date"
                  value={chartFilterDateTo}
                  onChange={(e) => setChartFilterDateTo(e.target.value)}
                  className="h-7 rounded border border-slate-200 px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            )}

            <select
              value={chartMetric}
              onChange={(e) => setChartMetric(e.target.value as typeof chartMetric)}
              className="ml-auto h-7 rounded border border-slate-200 px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="jobcards">Job Cards Done</option>
              <option value="turnaround">Turnaround Time</option>
              <option value="earnings">Earnings</option>
            </select>
          </div>

          <ServiceOverviewChart
            data={chartData}
            title={metricLabels[chartMetric]}
            headerSlot={<span />}
          />
        </div>
      </div>
    )
  }

  const handlePhotoUpload = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("employeeName", form.empName || "employee")

    setIsSaving(true)
    try {
      const response = await fetch("/api/uploads/employee-photo", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to upload employee photo")
      }

      setForm((prev) => ({ ...prev, facePhotoUrl: String(data.photoUrl || "") }))
      successAction("Employee photo uploaded")
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to upload employee photo")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
        <div className="global-main-form-content">
          {(() => {
            const shouldShowUnifiedLoader =
              isOpeningEmployee ||
              (Boolean(editingEmployeeId) && (statsLoading || !employeeStats))

            return (
              <>
          {shouldShowUnifiedLoader ? (
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Loading employee details and analytics...
            </div>
          ) : null}

          {!shouldShowUnifiedLoader && editingEmployeeId && employeeStats ? (
            <div className="mb-5 space-y-4">
              {/* Compute filtered data based on chart filter selection */}
              {(() => {
                  const allOverview = employeeStats.serviceOverview
                  const [cfYear, cfMonth] = chartFilterMonth.split("-").map(Number)

                  const filteredOverview = (() => {
                    if (chartFilterMode === "month") {
                      return allOverview.filter((item) => {
                        const parts = item.month.split(" ")
                        const d = new Date(`${parts[0]} 1, ${parts[1]}`)
                        return d.getFullYear() === cfYear && d.getMonth() + 1 === cfMonth
                      })
                    }
                    const fromD = chartFilterDateFrom ? new Date(chartFilterDateFrom) : null
                    const toD = chartFilterDateTo ? new Date(chartFilterDateTo) : null
                    if (!fromD && !toD) return allOverview
                    return allOverview.filter((item) => {
                      const parts = item.month.split(" ")
                      const d = new Date(`${parts[0]} 1, ${parts[1]}`)
                      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
                      if (fromD && monthEnd < fromD) return false
                      if (toD && d > toD) return false
                      return true
                    })
                  })()

                  const fTotalJobs = filteredOverview.reduce((s, o) => s + o.services, 0)
                  const fIncome = filteredOverview.reduce((s, o) => s + o.income, 0)
                  const fVehicles = filteredOverview.reduce((s, o) => s + o.vehicles, 0)
                  const taMonths = filteredOverview.filter((o) => o.avgTurnaround > 0)
                  const fAvgTurnaround = taMonths.length > 0
                    ? Math.round(taMonths.reduce((s, o) => s + o.avgTurnaround, 0) / taMonths.length)
                    : 0

                  const metricLabels: Record<string, string> = {
                    jobcards: "Job Cards Done",
                    turnaround: "Avg Turnaround (mins)",
                    earnings: "Earnings (₹)",
                  }

                  const chartData = filteredOverview.map((item) => ({
                    month: item.month,
                    services:
                      chartMetric === "jobcards" ? item.services
                      : chartMetric === "turnaround" ? item.avgTurnaround
                      : Math.round(item.income),
                  }))

                  return (
                    <>
                      {/* Row 1 — 5 stat cards (filtered) */}
                      <div className="grid grid-cols-1 gap-[1mm] sm:grid-cols-3 xl:grid-cols-5">
                        <div className="dashboard-card flex items-center gap-3 p-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 shrink-0">
                            <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 7h18M3 12h18M3 17h18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs text-muted-foreground truncate">Total Job Cards</span>
                            <span className="text-xl font-heading font-bold text-card-foreground">{fTotalJobs.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="dashboard-card flex items-center gap-3 p-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 shrink-0">
                            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 8v4l3 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" strokeWidth="1.5"/></svg>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs text-muted-foreground truncate">Vehicles Attended</span>
                            <span className="text-xl font-heading font-bold text-card-foreground">{fVehicles.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="dashboard-card flex items-center gap-3 p-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 shrink-0">
                            <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17l4-8 4 4 4-6 4 10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs text-muted-foreground truncate">Breakdown Pickups</span>
                            <span className="text-xl font-heading font-bold text-card-foreground">{employeeStats.breakdownPickups.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="dashboard-card flex items-center gap-3 p-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 shrink-0">
                            <svg className="w-5 h-5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 6v6l4 2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" strokeWidth="1.5"/></svg>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs text-muted-foreground truncate">Avg Turnaround</span>
                            <span className="text-xl font-heading font-bold text-card-foreground">{fAvgTurnaround}<span className="text-sm font-normal ml-0.5">m</span></span>
                          </div>
                        </div>
                        <div className="dashboard-card flex items-center gap-3 p-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 shrink-0">
                            <svg className="w-5 h-5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs text-muted-foreground truncate">Total Income</span>
                            <span className="text-xl font-heading font-bold text-card-foreground">₹{fIncome.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Row 2 — Full-width chart with inline filter controls */}
                      <div className="dashboard-card p-4">
                        {/* Chart controls */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          {/* Period mode toggle */}
                          <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs shrink-0">
                            <button
                              onClick={() => setChartFilterMode("month")}
                              className={`px-3 py-1.5 font-medium transition-colors ${chartFilterMode === "month" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                            >Month</button>
                            <button
                              onClick={() => setChartFilterMode("range")}
                              className={`px-3 py-1.5 font-medium transition-colors ${chartFilterMode === "range" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                            >Date Range</button>
                          </div>

                          {/* Month selector */}
                          {chartFilterMode === "month" ? (
                            <div className="flex items-center gap-1 text-xs shrink-0">
                              <button
                                onClick={() => {
                                  const d = new Date(cfYear, cfMonth - 2, 1)
                                  setChartFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                              >‹</button>
                              <span className="font-medium text-slate-700 w-28 text-center">
                                {new Date(cfYear, cfMonth - 1, 1).toLocaleString("en", { month: "long", year: "numeric" })}
                              </span>
                              <button
                                onClick={() => {
                                  const d = new Date(cfYear, cfMonth, 1)
                                  setChartFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                              >›</button>
                            </div>
                          ) : (
                            /* Date range pickers */
                            <div className="flex items-center gap-1.5 text-xs">
                              <input
                                type="date"
                                value={chartFilterDateFrom}
                                onChange={(e) => setChartFilterDateFrom(e.target.value)}
                                className="h-7 rounded border border-slate-200 px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <span className="text-slate-400">—</span>
                              <input
                                type="date"
                                value={chartFilterDateTo}
                                onChange={(e) => setChartFilterDateTo(e.target.value)}
                                className="h-7 rounded border border-slate-200 px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>
                          )}

                          {/* Chart metric selector */}
                          <select
                            value={chartMetric}
                            onChange={(e) => setChartMetric(e.target.value as typeof chartMetric)}
                            className="ml-auto h-7 rounded border border-slate-200 px-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            <option value="jobcards">Job Cards Done</option>
                            <option value="turnaround">Turnaround Time</option>
                            <option value="earnings">Earnings</option>
                          </select>
                        </div>

                        {/* Chart */}
                        <ServiceOverviewChart
                          data={chartData}
                          title={metricLabels[chartMetric]}
                          headerSlot={<span />}
                        />
                      </div>

                      {/* Row 3 — Attendance Calendar (month nav only) */}
                      {(() => {
                        const [calYear, calMonth] = selectedMonth.split("-").map(Number)
                        const daysInMonth = new Date(calYear, calMonth, 0).getDate()
                        const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay()

                        let dailyBase = 0
                        if (form.salaryType === "PerDay") {
                          dailyBase = Number(form.basicSalary) || 0
                        } else {
                          const gross = Number(form.grossSalary) || 0
                          const workDays = Number(form.workingDaysInMonth) || 26
                          dailyBase = gross / workDays
                        }
                        const deductionBase =
                          (Number(form.pfApplicable) || 0) +
                          (Number(form.esiApplicable) || 0) +
                          (Number(form.professionalTaxApplicable) || 0)
                        const dailyDeduction =
                          form.salaryType === "PerDay"
                            ? deductionBase
                            : deductionBase / (Number(form.workingDaysInMonth) || 26)

                        const dayMap = new Map<string, { attendance: string; earned: number }>()
                        employeeStats.attendanceRecords.forEach((r) => {
                          const key = r.date.slice(0, 10)
                          let base = 0
                          if (r.attendance === "Present") base = dailyBase - dailyDeduction
                          else if (r.attendance === "Half Day") base = (dailyBase - dailyDeduction) * 0.5
                          const earned = Math.max(0, base + (r.incentive || 0) + (r.allowance || 0) - (r.salaryAdvance || 0))
                          dayMap.set(key, { attendance: r.attendance, earned })
                        })

                        const today = new Date().toISOString().slice(0, 10)
                        const cells: React.ReactNode[] = []
                        for (let i = 0; i < firstDayOfWeek; i++) {
                          cells.push(<div key={`e-${i}`} />)
                        }
                        for (let d = 1; d <= daysInMonth; d++) {
                          const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                          const rec = dayMap.get(dateStr)
                          const isToday = dateStr === today
                          let bg = "bg-slate-50 border-slate-100"
                          if (rec) {
                            if (rec.attendance === "Present") bg = "bg-emerald-50 border-emerald-200"
                            else if (rec.attendance === "Half Day") bg = "bg-amber-50 border-amber-200"
                            else if (rec.attendance === "Absent") bg = "bg-red-50 border-red-200"
                            else bg = "bg-blue-50 border-blue-200"
                          }
                          cells.push(
                            <div key={d} className={`rounded border p-1 text-center min-h-[52px] ${bg} ${isToday ? "ring-2 ring-blue-400" : ""}`}>
                              <div className="text-[11px] font-semibold text-slate-600">{d}</div>
                              {rec ? (
                                <>
                                  <div className="text-[9px] text-slate-500 leading-tight">{rec.attendance}</div>
                                  <div className="text-[10px] font-medium text-slate-700">₹{rec.earned.toFixed(0)}</div>
                                </>
                              ) : null}
                            </div>
                          )
                        }

                        return (
                          <div className="dashboard-card p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-semibold">Attendance Calendar</h3>
                              <div className="flex items-center gap-1 text-xs">
                                <button
                                  onClick={() => {
                                    const d = new Date(calYear, calMonth - 2, 1)
                                    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
                                  }}
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                                >‹</button>
                                <span className="font-medium text-slate-700 w-28 text-center">
                                  {new Date(calYear, calMonth - 1, 1).toLocaleString("en", { month: "long", year: "numeric" })}
                                </span>
                                <button
                                  onClick={() => {
                                    const d = new Date(calYear, calMonth, 1)
                                    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
                                  }}
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                                >›</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-1">
                              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                                <div key={day} className="text-center text-[10px] font-semibold text-slate-400 py-1">{day}</div>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">{cells}</div>
                            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" />Present</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-200 inline-block" />Half Day</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-200 inline-block" />Absent</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-200 inline-block" />Leave</span>
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  )
                })()}
              </div>
          ) : null}
          {!shouldShowUnifiedLoader ? (
            <div className="space-y-2">
              {modalSuccessMessage ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {modalSuccessMessage}
                </div>
              ) : null}
              <div
                className="grid gap-3 mt-1 items-start"
                style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
              >
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-emp-name">Emp Name</Label>
                <Input
                  id="employee-emp-name"
                  value={form.empName}
                  onChange={(event) => setForm((prev) => ({ ...prev, empName: event.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-id-number">ID Number</Label>
                <Input
                  id="employee-id-number"
                  value={form.idNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, idNumber: event.target.value }))}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-mobile">Mobile</Label>
                <Input
                  id="employee-mobile"
                  value={form.mobile}
                  onChange={(event) => setForm((prev) => ({ ...prev, mobile: normalizeMobileNumber(event.target.value) }))}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-address-line-1">Address Line 1 (Apartment, Suite, Unit)</Label>
                <Input
                  id="employee-address-line-1"
                  value={form.addressLine1}
                  onChange={(event) => setForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-address-line-2">Address Line 2 (Street Address)</Label>
                <Input
                  id="employee-address-line-2"
                  value={form.addressLine2}
                  onChange={(event) => setForm((prev) => ({ ...prev, addressLine2: event.target.value }))}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-city">City</Label>
                <Input
                  id="employee-city"
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-state">State</Label>
                <Input
                  id="employee-state"
                  value={form.state}
                  onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-postal-code">Postal Code</Label>
                <Input
                  id="employee-postal-code"
                  value={form.postalCode}
                  onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-department">Department</Label>
                <Select
                  value={form.department || ""}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, department: val, designation: "" }))}
                >
                  <SelectTrigger id="employee-department" className="bg-muted/30">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {GARAGE_DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-designation">Designation</Label>
                <Select
                  value={form.designation || ""}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, designation: val }))}
                  disabled={!form.department}
                >
                  <SelectTrigger id="employee-designation" className="bg-muted/30">
                    <SelectValue placeholder={form.department ? "Select Designation" : "Select a department first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getDesignationsForDepartment(form.department).map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-start-date">Start Date</Label>
                <DatePickerInput
                  id="employee-start-date"
                  value={form.startDate}
                  onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))}
                  format="iso"
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-end-date">Last Working Day</Label>
                <DatePickerInput
                  id="employee-end-date"
                  value={form.endDate}
                  onChange={(value) => setForm((prev) => ({ ...prev, endDate: value }))}
                  format="iso"
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="employee-salary-type">Salary Type <span className="text-red-500">*</span></Label>
                <Select
                  value={form.salaryType}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, salaryType: val as "PerDay" | "Monthly" }))}
                >
                  <SelectTrigger id="employee-salary-type" className="bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PerDay">Per Day</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-4 rounded-md border border-slate-200 bg-slate-50/60 p-3 space-y-3">
                <div className="text-sm font-semibold text-slate-700">Payroll Components</div>

                {/* Basic + Working Days */}
                <div className="grid gap-3 md:grid-cols-6 [&_label]:min-h-[2.4rem] [&_label]:leading-5 [&_label]:flex [&_label]:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="employee-basic-salary">
                      Basic Salary {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                    </Label>
                    <Input
                      id="employee-basic-salary"
                      type="number"
                      min={0}
                      value={form.basicSalary}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, basicSalary: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-hra">
                      House Rent {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                    </Label>
                    <Input
                      id="employee-hra"
                      type="number"
                      min={0}
                      value={form.houseRentAllowance}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, houseRentAllowance: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-da">
                      Dearness Allow. {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                    </Label>
                    <Input
                      id="employee-da"
                      type="number"
                      min={0}
                      value={form.dearnessAllowance}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, dearnessAllowance: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-conveyance">
                      Conveyance {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                    </Label>
                    <Input
                      id="employee-conveyance"
                      type="number"
                      min={0}
                      value={form.conveyanceAllowance}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, conveyanceAllowance: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-medical">
                      Medical Allow. {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                    </Label>
                    <Input
                      id="employee-medical"
                      type="number"
                      min={0}
                      value={form.medicalAllowance}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, medicalAllowance: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-special">
                      Special Allow. {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                    </Label>
                    <Input
                      id="employee-special"
                      type="number"
                      min={0}
                      value={form.specialAllowance}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, specialAllowance: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-travel">
                      Travel Allow. {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                    </Label>
                    <Input
                      id="employee-travel"
                      type="number"
                      min={0}
                      value={form.travelAllowance}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, travelAllowance: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-internet">
                      Internet Allow. {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                    </Label>
                    <Input
                      id="employee-internet"
                      type="number"
                      min={0}
                      value={form.internetAllowance}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, internetAllowance: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-other-allowance">
                      Other Allow. {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                    </Label>
                    <Input
                      id="employee-other-allowance"
                      type="number"
                      min={0}
                      value={form.otherAllowance}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, otherAllowance: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-working-days">Working Days / Month</Label>
                    <Input
                      id="employee-working-days"
                      type="number"
                      min={1}
                      value={form.workingDaysInMonth}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, workingDaysInMonth: event.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Deductions */}
                <div className="rounded-md border border-red-100 bg-red-50/40 p-3">
                  <div className="mb-2 text-xs font-semibold text-red-700 uppercase tracking-wide">Deductions</div>
                  <div className="grid gap-3 md:grid-cols-6 [&_label]:min-h-[2.4rem] [&_label]:leading-5 [&_label]:flex [&_label]:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="employee-pf-applicable">
                        PF {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                      </Label>
                      <Input
                        id="employee-pf-applicable"
                        type="number"
                        min={0}
                        value={form.pfApplicable}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, pfApplicable: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employee-esi-applicable">
                        ESI {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                      </Label>
                      <Input
                        id="employee-esi-applicable"
                        type="number"
                        min={0}
                        value={form.esiApplicable}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, esiApplicable: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employee-pt-applicable">
                        Professional Tax {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                      </Label>
                      <Input
                        id="employee-pt-applicable"
                        type="number"
                        min={0}
                        value={form.professionalTaxApplicable}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, professionalTaxApplicable: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Gross Salary (locked, auto-calculated) */}
                <div className="grid gap-3 md:grid-cols-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="employee-gross-salary">
                      Gross Salary {form.salaryType === "PerDay" ? "/ Day" : "/ Month"}
                      <span className="ml-1 text-xs text-muted-foreground">(auto)</span>
                    </Label>
                    <Input
                      id="employee-gross-salary"
                      type="number"
                      value={form.grossSalary}
                      readOnly
                      className="bg-slate-100 cursor-not-allowed text-slate-600"
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-4">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      void handlePhotoUpload(file)
                    }
                    event.currentTarget.value = ""
                  }}
                />
                <div className="flex items-start justify-between gap-4 pt-2">
                  <div className="flex flex-col items-start gap-1 shrink-0" style={{ width: "2.75cm" }}>
                    <div
                      className="rounded-md border overflow-hidden bg-slate-50 w-full relative"
                      style={{ height: "3cm" }}
                    >
                      <Image
                        src={form.facePhotoUrl || "/dummy-profile.svg"}
                        alt="Employee face"
                        fill
                        className={form.facePhotoUrl ? "object-cover" : "object-contain p-4"}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-auto p-0 bg-transparent text-blue-600 hover:bg-blue-50 hover:text-blue-700 justify-center gap-1"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isSaving}
                      aria-label={form.facePhotoUrl ? "Update employee photo" : "Add employee photo"}
                    >
                      <Plus className="h-4 w-4" />
                      {form.facePhotoUrl ? "Update Photo" : "Add Photo"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="employee-is-technician"
                        checked={form.isTechnician}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, isTechnician: checked === true }))
                        }
                        className="w-4 h-4 aspect-square"
                      />
                      <Label htmlFor="employee-is-technician">Mark this employee as Technician</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="employee-attendance-eligible"
                        checked={form.isAttendanceEligible}
                        disabled={isAdminDesignation}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, isAttendanceEligible: checked === true }))
                        }
                        className="w-4 h-4 aspect-square"
                      />
                      <Label htmlFor="employee-attendance-eligible">
                        Allow this employee to use mobile attendance
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="employee-deregister-device"
                        checked={form.deregisterDevice}
                        disabled={!editingEmployeeId}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, deregisterDevice: checked === true }))
                        }
                        className="w-4 h-4 aspect-square"
                      />
                      <Label htmlFor="employee-deregister-device">
                        De-register device
                      </Label>
                    </div>

                    {isAdminDesignation ? (
                      <p className="text-xs text-muted-foreground pl-6">
                        Admin-designated employees are excluded from mobile attendance automatically.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              </div>
            </div>
          ) : null}
              </>
            )
          })()}
        </div>
    </div>
  )
}

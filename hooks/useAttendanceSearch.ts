"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"

export interface AttendanceEmployeeOption {
  employeeId: number
  empName: string
  idNumber?: string | null
  designation?: string | null
}

interface RawEmployee {
  employeeId: number
  empName?: string
  idNumber?: string | null
  designation?: string | null
}

export const useAttendanceSearch = (activeItem: string) => {
  const [attendancePayrollSearch, setAttendancePayrollSearch] = useState("")
  const [allEmployees, setAllEmployees] = useState<AttendanceEmployeeOption[]>([])
  const [isAttendanceSearchOpen, setIsAttendanceSearchOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const attendanceSearchInputRef = useRef<HTMLInputElement>(null)
  const attendanceSearchContainerRef = useRef<HTMLDivElement>(null)

  const loadEmployees = useCallback(async () => {
    if (isLoaded) return
    try {
      const response = await fetch("/api/employees", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      if (!Array.isArray(data)) return
      const employees: AttendanceEmployeeOption[] = data.map((e: RawEmployee) => ({
        employeeId: e.employeeId,
        empName: (e.empName || "").trim(),
        idNumber: e.idNumber || null,
        designation: e.designation || null,
      })).filter((e: AttendanceEmployeeOption) => e.empName)
      setAllEmployees(employees)
      setIsLoaded(true)
    } catch {
      // ignore
    }
  }, [isLoaded])

  const filteredEmployees = useMemo(() => {
    const query = attendancePayrollSearch.trim().toLowerCase()
    if (!query) return allEmployees
    return allEmployees.filter(
      (e) =>
        e.empName.toLowerCase().includes(query) ||
        (e.idNumber || "").toLowerCase().includes(query) ||
        (e.designation || "").toLowerCase().includes(query)
    )
  }, [allEmployees, attendancePayrollSearch])

  const attendanceDropdownNav = useDropdownKeyboardNav({
    itemCount: filteredEmployees.length,
    isOpen: isAttendanceSearchOpen,
    onSelect: (index) => {
      const emp = filteredEmployees[index]
      if (emp) {
        setAttendancePayrollSearch(emp.empName)
        setIsAttendanceSearchOpen(false)
      }
    },
    onClose: () => setIsAttendanceSearchOpen(false),
  })

  useEffect(() => {
    if (activeItem !== "attendance-payroll") {
      setIsAttendanceSearchOpen(false)
      return
    }
    loadEmployees()
  }, [activeItem, loadEmployees])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!attendanceSearchContainerRef.current?.contains(event.target as Node)) {
        setIsAttendanceSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openAttendanceDropdown = useCallback(() => {
    if (isAttendanceSearchOpen) { setIsAttendanceSearchOpen(false); return }
    setIsAttendanceSearchOpen(true)
    attendanceDropdownNav.resetHighlight()
    loadEmployees()
  }, [attendanceDropdownNav, isAttendanceSearchOpen, loadEmployees])

  return {
    attendancePayrollSearch,
    setAttendancePayrollSearch,
    filteredEmployees,
    isAttendanceSearchOpen,
    setIsAttendanceSearchOpen,
    attendanceSearchInputRef,
    attendanceSearchContainerRef,
    openAttendanceDropdown,
    attendanceDropdownNav,
  }
}

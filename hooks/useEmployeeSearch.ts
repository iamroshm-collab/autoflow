"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"

export interface EmployeeSearchOption {
  employeeId: number
  empName: string
  mobile: string
  designation: string | null
}

export const useEmployeeSearch = (activeItem: string) => {
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [employeeSearchResults, setEmployeeSearchResults] = useState<EmployeeSearchOption[]>([])
  const [isEmployeeSearchOpen, setIsEmployeeSearchOpen] = useState(false)
  const [isEmployeeSearchLoading, setIsEmployeeSearchLoading] = useState(false)
  const [selectedEmployeeRecordId, setSelectedEmployeeRecordId] = useState<number | null>(null)

  const employeeSearchInputRef = useRef<HTMLInputElement>(null)
  const employeeSearchContainerRef = useRef<HTMLDivElement>(null)
  const employeeSearchDebounceRef = useRef<number | null>(null)

  const loadEmployeeSearchResults = useCallback(async (search: string) => {
    setIsEmployeeSearchLoading(true)

    try {
      const response = await fetch(`/api/employees?search=${encodeURIComponent(search)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch employees")
      }

      setEmployeeSearchResults(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching employee search results:", error)
      setEmployeeSearchResults([])
    } finally {
      setIsEmployeeSearchLoading(false)
    }
  }, [])

  const handleSelectEmployeeSearchResult = useCallback((employee: EmployeeSearchOption) => {
    setEmployeeSearch(employee.empName)
    setSelectedEmployeeRecordId(employee.employeeId)
    setIsEmployeeSearchOpen(false)
    setEmployeeSearchResults([])
  }, [])

  const employeeDropdownNav = useDropdownKeyboardNav({
    itemCount: employeeSearchResults.length,
    isOpen: isEmployeeSearchOpen,
    onSelect: (index) => {
      const employee = employeeSearchResults[index]
      if (employee) {
        handleSelectEmployeeSearchResult(employee)
      }
    },
    onClose: () => setIsEmployeeSearchOpen(false),
  })

  useEffect(() => {
    if (activeItem !== "employee") {
      setIsEmployeeSearchOpen(false)
      setEmployeeSearchResults([])
      setSelectedEmployeeRecordId(null)
      return
    }

    if (!isEmployeeSearchOpen) {
      return
    }

    if (employeeSearchDebounceRef.current) {
      window.clearTimeout(employeeSearchDebounceRef.current)
    }

    employeeSearchDebounceRef.current = window.setTimeout(() => {
      loadEmployeeSearchResults(employeeSearch.trim())
    }, 180)

    return () => {
      if (employeeSearchDebounceRef.current) {
        window.clearTimeout(employeeSearchDebounceRef.current)
      }
    }
  }, [activeItem, employeeSearch, isEmployeeSearchOpen, loadEmployeeSearchResults])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!employeeSearchContainerRef.current?.contains(event.target as Node)) {
        setIsEmployeeSearchOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openEmployeeSearchDropdown = useCallback(() => {
    if (!isEmployeeSearchOpen) {
      setIsEmployeeSearchOpen(true)
      employeeDropdownNav.resetHighlight()
      void loadEmployeeSearchResults(employeeSearch.trim())
    }
  }, [employeeDropdownNav, employeeSearch, isEmployeeSearchOpen, loadEmployeeSearchResults])

  return {
    employeeSearch,
    setEmployeeSearch,
    employeeSearchResults,
    isEmployeeSearchOpen,
    setIsEmployeeSearchOpen,
    isEmployeeSearchLoading,
    selectedEmployeeRecordId,
    setSelectedEmployeeRecordId,
    employeeSearchInputRef,
    employeeSearchContainerRef,
    loadEmployeeSearchResults,
    handleSelectEmployeeSearchResult,
    openEmployeeSearchDropdown,
    employeeDropdownNav,
  }
}

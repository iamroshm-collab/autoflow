"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"

const TRANSACTION_TYPES = ["Income", "Expense"]

export const useIncomeExpenseSearch = (activeItem: string) => {
  const [incomeExpenseSearch, setIncomeExpenseSearch] = useState("")
  const [isIncomeExpenseSearchOpen, setIsIncomeExpenseSearchOpen] = useState(false)

  const incomeExpenseSearchInputRef = useRef<HTMLInputElement>(null)
  const incomeExpenseSearchContainerRef = useRef<HTMLDivElement>(null)

  const filteredTypes = TRANSACTION_TYPES.filter((t) =>
    t.toLowerCase().includes(incomeExpenseSearch.trim().toLowerCase())
  )

  const incomeExpenseDropdownNav = useDropdownKeyboardNav({
    itemCount: filteredTypes.length,
    isOpen: isIncomeExpenseSearchOpen,
    onSelect: (index) => {
      const t = filteredTypes[index]
      if (t) {
        setIncomeExpenseSearch(t)
        setIsIncomeExpenseSearchOpen(false)
      }
    },
    onClose: () => setIsIncomeExpenseSearchOpen(false),
  })

  useEffect(() => {
    if (activeItem !== "income-expense") {
      setIsIncomeExpenseSearchOpen(false)
    }
  }, [activeItem])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!incomeExpenseSearchContainerRef.current?.contains(event.target as Node)) {
        setIsIncomeExpenseSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openIncomeExpenseDropdown = useCallback(() => {
    if (isIncomeExpenseSearchOpen) { setIsIncomeExpenseSearchOpen(false); return }
    setIsIncomeExpenseSearchOpen(true)
    incomeExpenseDropdownNav.resetHighlight()
  }, [incomeExpenseDropdownNav, isIncomeExpenseSearchOpen])

  return {
    incomeExpenseSearch,
    setIncomeExpenseSearch,
    filteredTypes,
    isIncomeExpenseSearchOpen,
    setIsIncomeExpenseSearchOpen,
    incomeExpenseSearchInputRef,
    incomeExpenseSearchContainerRef,
    openIncomeExpenseDropdown,
    incomeExpenseDropdownNav,
  }
}

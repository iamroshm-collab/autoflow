"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"

export interface CustomerSearchOption {
  id: string
  name: string
  mobileNo: string
}

interface RawCustomer {
  id?: string
  name?: string
  mobileNo?: string
}

export const useCustomerSearch = (activeItem: string) => {
  const [customerSearch, setCustomerSearch] = useState("")
  const [results, setResults] = useState<CustomerSearchOption[]>([])
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const customerSearchInputRef = useRef<HTMLInputElement>(null)
  const customerSearchContainerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)

  const fetchCustomers = useCallback(async (query: string) => {
    setIsLoading(true)
    try {
      const url = `/api/customers?search=${encodeURIComponent(query.trim())}&limit=8`
      const response = await fetch(url, { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      const list: CustomerSearchOption[] = (Array.isArray(data) ? data : [])
        .slice(0, 8)
        .map((c: RawCustomer) => ({
          id: c.id || "",
          name: (c.name || "").trim(),
          mobileNo: c.mobileNo || "",
        }))
        .filter((c: CustomerSearchOption) => c.name)
      setResults(list)
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const filteredResults = useMemo(() => results, [results])

  const customerDropdownNav = useDropdownKeyboardNav({
    itemCount: filteredResults.length,
    isOpen: isCustomerSearchOpen,
    onSelect: (index) => {
      const c = filteredResults[index]
      if (c) {
        setCustomerSearch(c.name)
        setIsCustomerSearchOpen(false)
      }
    },
    onClose: () => setIsCustomerSearchOpen(false),
  })

  useEffect(() => {
    if (activeItem !== "customers") {
      setIsCustomerSearchOpen(false)
      setResults([])
      return
    }
  }, [activeItem])

  useEffect(() => {
    if (!isCustomerSearchOpen) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      fetchCustomers(customerSearch)
    }, 180)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [customerSearch, isCustomerSearchOpen, fetchCustomers])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!customerSearchContainerRef.current?.contains(event.target as Node)) {
        setIsCustomerSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openCustomerDropdown = useCallback(() => {
    setIsCustomerSearchOpen(true)
    customerDropdownNav.resetHighlight()
    fetchCustomers(customerSearch)
  }, [customerDropdownNav, customerSearch, fetchCustomers])

  return {
    customerSearch,
    setCustomerSearch,
    filteredResults,
    isCustomerSearchOpen,
    setIsCustomerSearchOpen,
    isLoading,
    customerSearchInputRef,
    customerSearchContainerRef,
    openCustomerDropdown,
    customerDropdownNav,
  }
}

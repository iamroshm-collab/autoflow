"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"

export interface InventorySupplierOption {
  supplierId: number
  supplierName: string
  mobile?: string
}

interface RawSupplier {
  supplierId?: number
  supplierName?: string
  mobile?: string
}

export const useInventorySupplierSearch = (activeItem: string, activeTab: string) => {
  const [inventorySearch, setInventorySearch] = useState("")
  const [allSuppliers, setAllSuppliers] = useState<InventorySupplierOption[]>([])
  const [isSupplierSearchOpen, setIsSupplierSearchOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const supplierSearchInputRef = useRef<HTMLInputElement>(null)
  const supplierSearchContainerRef = useRef<HTMLDivElement>(null)

  const loadSuppliers = useCallback(async () => {
    if (isLoaded) return
    try {
      const response = await fetch("/api/suppliers", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      const list: InventorySupplierOption[] = (Array.isArray(data) ? data : [])
        .map((s: RawSupplier) => ({
          supplierId: s.supplierId || 0,
          supplierName: (s.supplierName || "").trim(),
          mobile: s.mobile || "",
        }))
        .filter((s: InventorySupplierOption) => s.supplierName)
        .sort((a: InventorySupplierOption, b: InventorySupplierOption) =>
          a.supplierName.localeCompare(b.supplierName)
        )
      setAllSuppliers(list)
      setIsLoaded(true)
    } catch {
      // ignore
    }
  }, [isLoaded])

  const filteredSuppliers = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase()
    const list = query
      ? allSuppliers.filter(
          (s) =>
            s.supplierName.toLowerCase().includes(query) ||
            (s.mobile || "").toLowerCase().includes(query)
        )
      : allSuppliers
    return list.slice(0, 10)
  }, [allSuppliers, inventorySearch])

  const supplierDropdownNav = useDropdownKeyboardNav({
    itemCount: filteredSuppliers.length,
    isOpen: isSupplierSearchOpen,
    onSelect: (index) => {
      const s = filteredSuppliers[index]
      if (s) {
        setInventorySearch(s.supplierName)
        setIsSupplierSearchOpen(false)
      }
    },
    onClose: () => setIsSupplierSearchOpen(false),
  })

  useEffect(() => {
    if (activeItem !== "inventory" || activeTab !== "suppliers") {
      setIsSupplierSearchOpen(false)
      return
    }
    loadSuppliers()
  }, [activeItem, activeTab, loadSuppliers])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!supplierSearchContainerRef.current?.contains(event.target as Node)) {
        setIsSupplierSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openSupplierDropdown = useCallback(() => {
    setIsSupplierSearchOpen(true)
    supplierDropdownNav.resetHighlight()
    loadSuppliers()
  }, [supplierDropdownNav, loadSuppliers])

  return {
    inventorySearch,
    setInventorySearch,
    filteredSuppliers,
    isSupplierSearchOpen,
    setIsSupplierSearchOpen,
    supplierSearchInputRef,
    supplierSearchContainerRef,
    openSupplierDropdown,
    supplierDropdownNav,
  }
}

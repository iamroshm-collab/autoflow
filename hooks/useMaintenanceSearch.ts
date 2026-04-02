"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"

export interface MaintenanceSearchOption {
  vehicleId: string
  registrationNumber: string
  make: string
  model: string
  customerId: string
  customerName: string
  mobileNo: string
  deliveryDate?: string | null
}

interface RawJobCard {
  vehicle?: { id?: string; registrationNumber?: string; make?: string; model?: string }
  customer?: { id?: string; name?: string; mobileNo?: string }
  deliveryDate?: string | null
}

export const useMaintenanceSearch = (activeItem: string) => {
  const [maintenanceSearch, setMaintenanceSearch] = useState("")
  const [allOptions, setAllOptions] = useState<MaintenanceSearchOption[]>([])
  const [isMaintenanceSearchOpen, setIsMaintenanceSearchOpen] = useState(false)
  const [isOptionsLoaded, setIsOptionsLoaded] = useState(false)

  const maintenanceSearchInputRef = useRef<HTMLInputElement>(null)
  const maintenanceSearchContainerRef = useRef<HTMLDivElement>(null)

  const loadOptions = useCallback(async () => {
    if (isOptionsLoaded) return
    try {
      const response = await fetch("/api/maintenance/tracker", { cache: "no-store" })
      if (!response.ok) return
      const data: RawJobCard[] = await response.json()
      if (!Array.isArray(data)) return

      const vehicleMap = new Map<string, MaintenanceSearchOption>()
      data.forEach((jc) => {
        const key = `${jc.vehicle?.id}-${jc.customer?.id}`
        const existing = vehicleMap.get(key)
        const deliveryDate = jc.deliveryDate || null
        if (
          !existing ||
          (deliveryDate && existing.deliveryDate && new Date(deliveryDate) > new Date(existing.deliveryDate))
        ) {
          vehicleMap.set(key, {
            vehicleId: jc.vehicle?.id || "",
            registrationNumber: jc.vehicle?.registrationNumber || "",
            make: jc.vehicle?.make || "",
            model: jc.vehicle?.model || "",
            customerId: jc.customer?.id || "",
            customerName: jc.customer?.name || "",
            mobileNo: jc.customer?.mobileNo || "",
            deliveryDate,
          })
        }
      })

      const sorted = Array.from(vehicleMap.values()).sort((a, b) => {
        const aT = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0
        const bT = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0
        return bT - aT
      })

      setAllOptions(sorted)
      setIsOptionsLoaded(true)
    } catch {
      // ignore
    }
  }, [isOptionsLoaded])

  const filteredOptions = useMemo(() => {
    const query = maintenanceSearch.trim().toLowerCase()
    if (!query) return allOptions
    return allOptions.filter(
      (opt) =>
        opt.registrationNumber.toLowerCase().includes(query) ||
        opt.customerName.toLowerCase().includes(query) ||
        opt.mobileNo.toLowerCase().includes(query) ||
        `${opt.make} ${opt.model}`.toLowerCase().includes(query)
    )
  }, [allOptions, maintenanceSearch])

  const maintenanceDropdownNav = useDropdownKeyboardNav({
    itemCount: filteredOptions.length,
    isOpen: isMaintenanceSearchOpen,
    onSelect: (index) => {
      const opt = filteredOptions[index]
      if (opt) {
        setMaintenanceSearch(opt.registrationNumber)
        setIsMaintenanceSearchOpen(false)
      }
    },
    onClose: () => setIsMaintenanceSearchOpen(false),
  })

  useEffect(() => {
    if (activeItem !== "maintenance-tracker") {
      setIsMaintenanceSearchOpen(false)
      return
    }
    loadOptions()
  }, [activeItem, loadOptions])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!maintenanceSearchContainerRef.current?.contains(event.target as Node)) {
        setIsMaintenanceSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openMaintenanceDropdown = useCallback(() => {
    setIsMaintenanceSearchOpen(true)
    maintenanceDropdownNav.resetHighlight()
    loadOptions()
  }, [maintenanceDropdownNav, loadOptions])

  return {
    maintenanceSearch,
    setMaintenanceSearch,
    filteredOptions,
    isMaintenanceSearchOpen,
    setIsMaintenanceSearchOpen,
    maintenanceSearchInputRef,
    maintenanceSearchContainerRef,
    openMaintenanceDropdown,
    maintenanceDropdownNav,
  }
}

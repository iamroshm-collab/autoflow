"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"

interface TechnicianOption {
  isTechnician?: boolean | null
  empName?: string
}

export const useTechnicianSearch = (activeItem: string) => {
  const [technicianSearch, setTechnicianSearch] = useState("")
  const [technicianNames, setTechnicianNames] = useState<string[]>([])
  const [isTechnicianSearchOpen, setIsTechnicianSearchOpen] = useState(false)
  const [isTechnicianNamesLoaded, setIsTechnicianNamesLoaded] = useState(false)

  const technicianSearchInputRef = useRef<HTMLInputElement>(null)
  const technicianSearchContainerRef = useRef<HTMLDivElement>(null)

  const loadTechnicianNames = useCallback(async () => {
    if (isTechnicianNamesLoaded) return
    try {
      const response = await fetch("/api/employees", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data)) return
      const names: string[] = data
        .filter((e: TechnicianOption) => e?.isTechnician)
        .map((e: TechnicianOption) => (e.empName || "").trim())
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b))
      setTechnicianNames(Array.from(new Set(names)))
      setIsTechnicianNamesLoaded(true)
    } catch {
      // ignore fetch errors
    }
  }, [isTechnicianNamesLoaded])

  const filteredTechnicianNames = useMemo(() => {
    const query = technicianSearch.trim().toLowerCase()
    return query
      ? technicianNames.filter((name) => name.toLowerCase().includes(query))
      : technicianNames
  }, [technicianNames, technicianSearch])

  const technicianDropdownNav = useDropdownKeyboardNav({
    itemCount: filteredTechnicianNames.length,
    isOpen: isTechnicianSearchOpen,
    onSelect: (index) => {
      const name = filteredTechnicianNames[index]
      if (name) {
        setTechnicianSearch(name)
        setIsTechnicianSearchOpen(false)
      }
    },
    onClose: () => setIsTechnicianSearchOpen(false),
  })

  useEffect(() => {
    if (activeItem !== "technician-task-details") {
      setIsTechnicianSearchOpen(false)
      return
    }
    loadTechnicianNames()
  }, [activeItem, loadTechnicianNames])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!technicianSearchContainerRef.current?.contains(event.target as Node)) {
        setIsTechnicianSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openTechnicianSearchDropdown = useCallback(() => {
    setIsTechnicianSearchOpen(true)
    technicianDropdownNav.resetHighlight()
    loadTechnicianNames()
  }, [technicianDropdownNav, loadTechnicianNames])

  return {
    technicianSearch,
    setTechnicianSearch,
    filteredTechnicianNames,
    isTechnicianSearchOpen,
    setIsTechnicianSearchOpen,
    technicianSearchInputRef,
    technicianSearchContainerRef,
    openTechnicianSearchDropdown,
    technicianDropdownNav,
  }
}

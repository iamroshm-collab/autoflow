"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"

interface RawLedgerRow {
  shopName?: string
}

export const useSparePartsSearch = (activeItem: string) => {
  const [sparePartsSearch, setSparePartsSearch] = useState("")
  const [shopNames, setShopNames] = useState<string[]>([])
  const [isSparePartsSearchOpen, setIsSparePartsSearchOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const sparePartsSearchInputRef = useRef<HTMLInputElement>(null)
  const sparePartsSearchContainerRef = useRef<HTMLDivElement>(null)

  const loadShopNames = useCallback(async () => {
    if (isLoaded) return
    try {
      const response = await fetch("/api/spare-parts-ledger", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      const rows: RawLedgerRow[] = Array.isArray(data.rows) ? data.rows : []
      const names = Array.from(
        new Set(
          rows
            .map((r) => (r.shopName || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b))
      setShopNames(names)
      setIsLoaded(true)
    } catch {
      // ignore
    }
  }, [isLoaded])

  const filteredShopNames = useMemo(() => {
    const query = sparePartsSearch.trim().toLowerCase()
    return query
      ? shopNames.filter((n) => n.toLowerCase().includes(query))
      : shopNames
  }, [shopNames, sparePartsSearch])

  const sparePartsDropdownNav = useDropdownKeyboardNav({
    itemCount: filteredShopNames.length,
    isOpen: isSparePartsSearchOpen,
    onSelect: (index) => {
      const name = filteredShopNames[index]
      if (name) {
        setSparePartsSearch(name)
        setIsSparePartsSearchOpen(false)
      }
    },
    onClose: () => setIsSparePartsSearchOpen(false),
  })

  useEffect(() => {
    if (activeItem !== "spare-parts") {
      setIsSparePartsSearchOpen(false)
      return
    }
    loadShopNames()
  }, [activeItem, loadShopNames])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!sparePartsSearchContainerRef.current?.contains(event.target as Node)) {
        setIsSparePartsSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openSparePartsDropdown = useCallback(() => {
    if (isSparePartsSearchOpen) { setIsSparePartsSearchOpen(false); return }
    setIsSparePartsSearchOpen(true)
    sparePartsDropdownNav.resetHighlight()
    loadShopNames()
  }, [isSparePartsSearchOpen, sparePartsDropdownNav, loadShopNames])

  return {
    sparePartsSearch,
    setSparePartsSearch,
    filteredShopNames,
    isSparePartsSearchOpen,
    setIsSparePartsSearchOpen,
    sparePartsSearchInputRef,
    sparePartsSearchContainerRef,
    openSparePartsDropdown,
    sparePartsDropdownNav,
  }
}

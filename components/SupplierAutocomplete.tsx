"use client"

import React, { useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"
import { subscribeSuppliers } from "@/lib/suppliers"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"

export type AutocompleteSupplier = {
  supplierId: number
  supplierName: string
  mobileNo?: string
}

type Props = {
  placeholder?: string
  onSelect: (s: AutocompleteSupplier) => void
  fetchUrl?: string
  inputClassName?: string
}

export function SupplierAutocomplete({
  placeholder = "Search supplier",
  onSelect,
  fetchUrl = "/api/suppliers",
  inputClassName = "",
}: Props) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AutocompleteSupplier[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<number | null>(null)

  // Supplier dropdown keyboard navigation
  const dropdownNav = useDropdownKeyboardNav({
    itemCount: items.length,
    isOpen: open,
    onSelect: (index) => {
      if (index >= 0 && index < items.length) {
        handleSelect(items[index])
      }
    },
    onClose: () => setOpen(false),
  })

  const load = async (search: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${fetchUrl}?search=${encodeURIComponent(search)}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : data.suppliers || [])
    } catch (err) {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      if (open) load(q || "")
    }, 220)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [q, open, fetchUrl])

  useEffect(() => {
    // subscribe to supplier changes elsewhere in the app
    const unsub = subscribeSuppliers(() => {
      if (open) load(q || "")
    })
    return unsub
  }, [open, q, fetchUrl])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  function handleSelect(s: AutocompleteSupplier) {
    onSelect(s)
    setOpen(false)
    setQ("")
    setItems([])
    dropdownNav.resetHighlight()
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <input
        id="supplier-autocomplete"
        name="supplierAutocomplete"
        aria-autocomplete="list"
        aria-expanded={open}
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          const v = e.target.value
          setQ(v)
          // Keep dropdown open and filter results as user types
          if (!open) {
            setOpen(true)
          }
          dropdownNav.resetHighlight()
        }}
        onClick={() => {
          setOpen((prev) => {
            const newOpen = !prev
            if (newOpen) {
              load(q || "")
            }
            return newOpen
          })
        }}
        onKeyDown={(e) => {
          if (open) {
            dropdownNav.handleKeyDown(e as any)
          }
        }}
        className={`w-full h-8 rounded-sm border border-border/90 px-2 pl-9 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring/70 text-sm ${inputClassName}`}
      />

      {open && (loading || items.length > 0) && (
        <div className="absolute left-0 right-0 mt-1 z-50 dropdown-scroll">
          {loading ? (
            <div className="dropdown-empty-state">Loading…</div>
          ) : (
            items.map((s, i) => (
              <button
                key={s.supplierId}
                {...dropdownNav.getItemProps(i)}
                role="option"
                aria-selected={i === dropdownNav.highlightedIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className={`dropdown-item ${i === dropdownNav.highlightedIndex ? 'selected' : ''}`}
              >
                <div className="font-medium">{s.supplierName}</div>
                {s.mobileNo && <div className="text-xs text-muted-foreground">{s.mobileNo}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default SupplierAutocomplete

"use client"

import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export type AutocompleteShop = {
  id: string
  shopName: string
  mobile?: string
  address?: string
}

type Props = {
  inputId?: string
  placeholder?: string
  value?: string
  onSelect: (shopName: string) => void
  onChange?: (value: string) => void
  fetchUrl?: string
  disabled?: boolean
  inputClassName?: string
  renderInPortal?: boolean
}

export function ShopAutocomplete({
  inputId,
  placeholder = "Search shop",
  value = "",
  onSelect,
  onChange,
  fetchUrl = "/api/settings/spare-part-shops",
  disabled = false,
  inputClassName = "",
  renderInPortal = false,
}: Props) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AutocompleteShop[]>([])
  const [highlight, setHighlight] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const updateDropdownPosition = () => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
    })
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const load = async (search: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${fetchUrl}?search=${encodeURIComponent(search)}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Error loading shops:", err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setQ(value)
  }, [value])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (open) load(q || "")
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q, open, fetchUrl])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (!containerRef.current) return
      if (containerRef.current.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  useEffect(() => {
    if (!open || !renderInPortal) return
    updateDropdownPosition()
    window.addEventListener("scroll", updateDropdownPosition, true)
    window.addEventListener("resize", updateDropdownPosition)
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true)
      window.removeEventListener("resize", updateDropdownPosition)
    }
  }, [open, renderInPortal])

  function handleSelect(shop: AutocompleteShop) {
    onSelect(shop.shopName)
    setQ(shop.shopName)
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, items.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const shop = items[highlight]
      if (shop) handleSelect(shop)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        id={inputId}
        aria-autocomplete="list"
        aria-expanded={open}
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          const v = e.target.value
          setQ(v)
          onChange?.(v)
          if (renderInPortal) updateDropdownPosition()
          setOpen(true)
        }}
        onFocus={() => {
          if (renderInPortal) updateDropdownPosition()
          setOpen(true)
          setHighlight(0)
          if (q.trim().length === 0) {
            load("")
          }
        }}
        onKeyDown={onKey}
        disabled={disabled}
        className={inputClassName || "h-10 w-full rounded border px-2 text-xs text-center disabled:bg-gray-100"}
      />

      {open && (loading || items.length > 0) && (() => {
        const dropdownContent = (
          <div
            ref={dropdownRef}
            className={renderInPortal ? "fixed z-[9999] dropdown-scroll" : "absolute top-full left-0 mt-1 z-50 w-full dropdown-scroll"}
            style={renderInPortal ? { top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px`, width: `${dropdownPos.width}px` } : undefined}
          >
            {loading ? (
              <div className="dropdown-empty-state">Loading…</div>
            ) : items.length === 0 && q.trim().length > 0 ? (
              <div className="dropdown-empty-state">No shops found</div>
            ) : (
              items.map((shop, i) => (
                <button
                  key={shop.id}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => handleSelect(shop)}
                  className={`dropdown-item text-xs ${i === highlight ? "selected" : ""}`}
                >
                  <div className="font-medium">{shop.shopName}</div>
                  {shop.mobile && (
                    <div className="text-xs text-muted-foreground">{shop.mobile}</div>
                  )}
                </button>
              ))
            )}
          </div>
        )

        return renderInPortal && isMounted ? createPortal(dropdownContent, document.body) : dropdownContent
      })()}
    </div>
  )
}

export default ShopAutocomplete

"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

export interface EdgeTabItem {
  key: string
  label: string
  icon?: React.ReactNode
  href?: string
}

interface EdgeTabsProps {
  tabs: EdgeTabItem[]
  activeKey: string
  onChange: (key: string) => void
  syncWithPath?: boolean
  navigateOnClick?: boolean
  className?: string
}

export function EdgeTabs({
  tabs,
  activeKey,
  onChange,
  syncWithPath = false,
  navigateOnClick = false,
  className = "",
}: EdgeTabsProps) {
  const pathname = usePathname()
  const router = useRouter()

  const keyFromPath = useMemo(() => {
    if (!syncWithPath || !pathname) return undefined
    const found = tabs.find((t) => t.href && (t.href === pathname || pathname.startsWith(t.href)))
    if (found) return found.key
    const byKey = tabs.find((t) => pathname.includes(t.key))
    return byKey?.key
  }, [syncWithPath, pathname, tabs])

  useEffect(() => {
    if (keyFromPath && keyFromPath !== activeKey) onChange(keyFromPath)
  }, [keyFromPath, activeKey, onChange])

  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [focusedIndex, setFocusedIndex] = useState(() => {
    const idx = tabs.findIndex((t) => t.key === activeKey)
    return idx >= 0 ? idx : 0
  })

  useEffect(() => {
    const idx = tabs.findIndex((t) => t.key === activeKey)
    if (idx >= 0) setFocusedIndex(idx)
  }, [activeKey, tabs])

  const focusButton = (idx: number) => {
    const el = buttonRefs.current[idx]
    if (el) el.focus()
  }

  const activateAt = (idx: number) => {
    const tab = tabs[idx]
    if (!tab) return
    setFocusedIndex(idx)
    onChange(tab.key)
    if (tab.href && navigateOnClick) {
      void router.push(tab.href)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = tabs.length - 1
    let newIndex: number | null = null

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        newIndex = i === last ? 0 : i + 1
        break
      case "ArrowLeft":
      case "ArrowUp":
        newIndex = i === 0 ? last : i - 1
        break
      case "Home":
        newIndex = 0
        break
      case "End":
        newIndex = last
        break
      case "Enter":
      case " ":
        e.preventDefault()
        activateAt(i)
        return
      default:
        return
    }

    if (newIndex !== null) {
      e.preventDefault()
      setFocusedIndex(newIndex)
      focusButton(newIndex)
      activateAt(newIndex)
    }
  }

  const handleClick = (tab: EdgeTabItem, i: number) => {
    setFocusedIndex(i)
    if (tab.key !== activeKey) onChange(tab.key)
    if (navigateOnClick && tab.href) {
      void router.push(tab.href)
    }
  }

  return (
    <nav role="tablist" aria-label="Primary" className={`w-full ${className}`}>
      <div className="inline-flex items-end gap-2 border-b border-border bg-transparent p-0 h-auto">
        {tabs.map((tab, i) => {
          const isActive = tab.key === activeKey
          const icon = tab.icon ? (
            <span className={`${isActive ? "text-sky-600" : "text-slate-500"} h-4 w-4 inline-flex items-center`}>
              {tab.icon}
            </span>
          ) : null

          return (
            <button
              key={tab.key}
              ref={(el) => {
                buttonRefs.current[i] = el
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={focusedIndex === i ? 0 : -1}
              onClick={() => handleClick(tab, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-xl px-5 py-2 text-sm font-medium transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 ${
                isActive
                  ? "bg-white border border-border border-b-0 rounded-b-none -mb-px relative z-10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

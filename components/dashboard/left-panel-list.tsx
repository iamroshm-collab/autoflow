"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { List, useListCallbackRef, type RowComponentProps } from "react-window"
import { Input } from "@/components/ui/input"

export interface LeftPanelItem {
  id: string
  jobCardNumber: string
  status: string
  customerName: string
  vehicleNumber: string
  vehicleMake?: string
  vehicleModel?: string
  workDescription?: string
  technicianName?: string
}

interface LeftPanelListProps {
  items: LeftPanelItem[]
  selectedId?: string | null
  onSelect: (item: LeftPanelItem) => void
}

/** Height of each row in pixels, including the bottom gap. */
const ROW_HEIGHT = 104

function statusBadgeClass(status: string): string {
  const s = status.trim().toLowerCase()
  if (s === "assigned") return "bg-amber-100 text-amber-800"
  if (s === "accepted") return "bg-blue-100 text-blue-800"
  if (s === "in_progress") return "bg-violet-100 text-violet-800"
  if (s === "completed") return "bg-emerald-100 text-emerald-800"
  if (s === "ready") return "bg-cyan-100 text-cyan-800"
  if (s === "delivered") return "bg-slate-200 text-slate-800"
  return "bg-slate-100 text-slate-700"
}

function formatStatusLabel(status: string): string {
  return (status || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Unknown"
}

// ─── Extra data passed to every row via rowProps ─────────────────────────────

interface RowExtraProps {
  items: LeftPanelItem[]
  selectedId: string | null | undefined
  onSelect: (item: LeftPanelItem) => void
}

// ─── Row renderer ─────────────────────────────────────────────────────────────

type VehicleRowProps = RowComponentProps<RowExtraProps>

function VehicleRow({ index, style, items, selectedId, onSelect }: VehicleRowProps) {
  const item = items[index]
  if (!item) return null

  const isSelected = item.id === selectedId
  const vehicleLabel =
    [item.vehicleMake, item.vehicleModel].filter(Boolean).join(" ") || item.vehicleNumber
  const bottomLine = item.workDescription || item.technicianName || "—"

  return (
    // Outer wrapper uses the injected `style` (position + height) from the virtualiser.
    // The inner card has a small bottom padding acting as the gap between rows.
    <div style={style} className="px-0 pb-2">
      <button
        type="button"
        onClick={() => onSelect(item)}
        className={`h-full w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
          isSelected
            ? "border-sky-300 bg-sky-50 shadow-sm"
            : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white"
        }`}
      >
        {/* Row 1: Job Card Number + Status badge */}
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{item.jobCardNumber}</p>
          <span
            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
              item.status
            )}`}
          >
            {formatStatusLabel(item.status)}
          </span>
        </div>

        {/* Row 2: Customer Name + Vehicle */}
        <p className="mt-1 truncate text-xs text-slate-600">
          {item.customerName}
          {vehicleLabel ? <span className="text-slate-400"> · {vehicleLabel}</span> : null}
        </p>

        {/* Row 3: Work Description or Technician */}
        <p className="mt-0.5 truncate text-xs text-slate-400">{bottomLine}</p>
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeftPanelList({ items, selectedId, onSelect }: LeftPanelListProps) {
  const [query, setQuery] = useState("")
  const [listApi, setListApi] = useListCallbackRef()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.jobCardNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.vehicleNumber.toLowerCase().includes(q) ||
        (item.vehicleMake ?? "").toLowerCase().includes(q) ||
        (item.vehicleModel ?? "").toLowerCase().includes(q) ||
        (item.workDescription ?? "").toLowerCase().includes(q) ||
        (item.technicianName ?? "").toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q)
    )
  }, [items, query])

  // Stable rowProps object — only changes when filtered list or selection changes
  const rowProps = useMemo<RowExtraProps>(
    () => ({ items: filtered, selectedId, onSelect }),
    [filtered, selectedId, onSelect]
  )

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
      listApi?.scrollToRow({ index: 0, behavior: "instant" })
    },
    [listApi]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Search input */}
      <Input
        value={query}
        onChange={handleQueryChange}
        placeholder="Search job card, customer, vehicle…"
        autoComplete="off"
        className="shrink-0 text-xs"
      />

      {/* Virtual list */}
      {filtered.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">No results</p>
      ) : (
        <div className="min-h-0 flex-1">
          <List
            listRef={setListApi}
            rowComponent={VehicleRow}
            rowCount={filtered.length}
            rowHeight={ROW_HEIGHT}
            rowProps={rowProps}
            overscanCount={8}
            style={{ height: "100%", width: "100%", overflowX: "hidden" }}
          />
        </div>
      )}
    </div>
  )
}

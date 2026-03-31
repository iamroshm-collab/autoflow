"use client"

import { useEffect, useState } from "react"
import { notify } from "@/components/ui/notify"
import { formatDateDDMMYY } from "@/lib/utils"

type InventoryMovementRow = {
  id: number
  itemId: number
  movementType: "PURCHASE" | "JOBCARD_USAGE" | "SALE" | "ADJUSTMENT"
  quantity: number
  referenceType: "PURCHASE" | "JOBCARD" | "SALE" | "MANUAL"
  referenceId?: number | null
  remarks?: string | null
  createdAt: string
  item?: {
    productId: number
    productName: string
  }
}

export function InventoryMovementForm() {
  const [movements, setMovements] = useState<InventoryMovementRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadMovements = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/inventory/movement?limit=25")
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load inventory movements")
      }
      setMovements(Array.isArray(data?.movements) ? data.movements : [])
    } catch (error) {
      console.error("[INVENTORY_MOVEMENT_FORM_LIST]", error)
      notify.error("Failed to load inventory movements")
      setMovements([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadMovements()
  }, [])

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-slate-100/80">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-left font-medium">Movement Type</th>
              <th className="px-3 py-2 text-left font-medium">Quantity</th>
              <th className="px-3 py-2 text-left font-medium">Reference</th>
              <th className="px-3 py-2 text-left font-medium">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading movements...</td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No movements found.</td>
              </tr>
            ) : (
              movements.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{formatDateDDMMYY(row.createdAt)}</td>
                  <td className="px-3 py-2">{row.item?.productName || `Item #${row.itemId}`}</td>
                  <td className="px-3 py-2">{row.movementType}</td>
                  <td className={`px-3 py-2 font-medium ${row.quantity > 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                  </td>
                  <td className="px-3 py-2">{row.referenceType}{row.referenceId ? ` #${row.referenceId}` : ""}</td>
                  <td className="px-3 py-2">{row.remarks || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

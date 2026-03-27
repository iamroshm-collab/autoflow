import type { MutableRefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import ShopAutocomplete from "@/components/ShopAutocomplete"
import DatePickerInput from "@/components/ui/date-picker-input"
import type { SparePartRow } from "./types"

interface SparePartsTableProps {
  rows: SparePartRow[]
  isLoading: boolean
  sparePartRefsMap: MutableRefObject<Map<string, HTMLInputElement>>
  onChange: (
    rowId: string,
    field: keyof Omit<SparePartRow, "id">,
    value: string | number | boolean
  ) => void
  onRowFocus: (rowId: string) => void
  onRemoveRow: (rowId: string) => void
  onAddRow: () => void
}

export function SparePartsTable({
  rows,
  isLoading,
  sparePartRefsMap,
  onChange,
  onRowFocus,
  onRemoveRow,
  onAddRow,
}: SparePartsTableProps) {
  return (
    <div className="global-subform-table-content flex min-h-0 flex-col">
      <div className="form-table-wrapper shrink-0">
        <table className="w-full table-fixed">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="text-center" style={{ width: "16%" }}>Shop Name</th>
              <th className="text-center" style={{ width: "8.4%" }}>Bill Date</th>
              <th className="text-center" style={{ width: "12%" }}>Bill Number</th>
              <th className="text-center" style={{ width: "28.4%" }}>Item</th>
              <th className="text-center" style={{ width: "9%" }}>Amount</th>
              <th className="text-center" style={{ width: "9%" }}>Paid</th>
              <th className="text-center" style={{ width: "9%" }}>Paid Date</th>
              <th className="text-center" style={{ width: "6%" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-sm text-muted-foreground" colSpan={8}>
                  No spare parts added.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t [&>td]:align-middle">
                  <td>
                    <ShopAutocomplete
                      placeholder="Search shop"
                      value={row.shopName ?? ""}
                      onSelect={(shopName) => onChange(row.id, "shopName", shopName)}
                      onChange={(value) => onChange(row.id, "shopName", value)}
                      renderInPortal
                      disabled={isLoading}
                      inputClassName="w-full text-center"
                    />
                  </td>
                  <td>
                    <DatePickerInput
                      value={row.billDate ?? ""}
                      onChange={(value) => onChange(row.id, "billDate", value)}
                      disabled={isLoading}
                      placeholder="dd-mm-yy"
                      format="dd-mm-yy"
                    />
                  </td>
                  <td>
                    <Input
                      name="billNumber"
                      ref={(el) => {
                        if (el) sparePartRefsMap.current.set(`${row.id}-billNumber`, el)
                      }}
                      value={row.billNumber ?? ""}
                      onChange={(e) => onChange(row.id, "billNumber", e.target.value)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="w-full text-center"
                    />
                  </td>
                  <td>
                    <Input
                      name="item"
                      ref={(el) => {
                        if (el) sparePartRefsMap.current.set(`${row.id}-item`, el)
                      }}
                      value={row.item ?? ""}
                      onChange={(e) => onChange(row.id, "item", e.target.value)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="w-full text-center"
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      ref={(el) => {
                        if (el) sparePartRefsMap.current.set(`${row.id}-amount`, el)
                      }}
                      value={row.amount ?? 0}
                      onChange={(e) => onChange(row.id, "amount", Number(e.target.value) || 0)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="w-full text-center"
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      value={row.paid ?? 0}
                      onChange={(e) => onChange(row.id, "paid", Number(e.target.value) || 0)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="w-full text-center"
                    />
                  </td>
                  <td>
                    <DatePickerInput
                      value={row.paidDate ?? ""}
                      onChange={(value) => onChange(row.id, "paidDate", value)}
                      disabled={isLoading}
                      placeholder="dd-mm-yy"
                      format="dd-mm-yy"
                    />
                  </td>
                  <td className="text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveRow(row.id)}
                      disabled={isLoading}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label="Remove spare part row"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="shrink-0">
        <Button type="button" onClick={onAddRow} className="global-bottom-btn-add" variant="ghost">
          <Plus className="h-4 w-4 mr-2" />
          Add Spare Part
        </Button>
      </div>
    </div>
  )
}

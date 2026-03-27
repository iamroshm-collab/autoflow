import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import DatePickerInput from "@/components/ui/date-picker-input"
import { Plus, Trash2 } from "lucide-react"
import type { SparePartReturnRow } from "./types"

interface SparePartReturnTableProps {
  rows: SparePartReturnRow[]
  sparePartBillOptions: string[]
  isLoading: boolean
  onChange: (
    rowId: string,
    field: keyof Omit<SparePartReturnRow, "id">,
    value: string | number
  ) => void
  onRowFocus: (rowId: string) => void
  onRemoveRow: (rowId: string) => void
  onAddRow: () => void
}

export function SparePartReturnTable({
  rows,
  sparePartBillOptions,
  isLoading,
  onChange,
  onRowFocus,
  onRemoveRow,
  onAddRow,
}: SparePartReturnTableProps) {
  return (
    <div className="global-subform-table-content flex min-h-0 flex-col">
      <div className="form-table-wrapper shrink-0">
        <table className="w-full text-xs table-fixed">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="text-center" style={{ width: "40%" }}>Bill Number</th>
              <th className="text-center" style={{ width: "26%" }}>Return Date (dd-mm-yy)</th>
              <th className="text-center" style={{ width: "26%" }}>Return Amount</th>
              <th className="text-center" style={{ width: "8%" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-sm text-muted-foreground" colSpan={4}>
                  No spare parts returns added.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t [&>td]:align-middle">
                  <td>
                    <Select
                      value={row.billNumber}
                      onValueChange={(value) => onChange(row.id, "billNumber", value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-10 text-sm" onFocus={() => onRowFocus(row.id)}>
                        <SelectValue placeholder="Select bill" />
                      </SelectTrigger>
                      <SelectContent>
                        {sparePartBillOptions.map((billNo) => (
                          <SelectItem key={billNo} value={billNo}>
                            {billNo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <DatePickerInput
                      value={row.returnDate}
                      onChange={(value) => onChange(row.id, "returnDate", value)}
                      disabled={isLoading}
                      placeholder="dd-mm-yy"
                      format="dd-mm-yy"
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      value={row.returnAmount}
                      onChange={(e) => onChange(row.id, "returnAmount", Number(e.target.value) || 0)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="h-10 w-full px-2 text-sm text-center"
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
                      aria-label="Remove return row"
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
          Add Spare Part Return
        </Button>
      </div>
    </div>
  )
}

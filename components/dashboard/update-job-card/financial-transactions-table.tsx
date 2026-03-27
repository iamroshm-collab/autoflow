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
import type { FinancialTransactionRow } from "./types"

interface FinancialTransactionsTableProps {
  rows: FinancialTransactionRow[]
  isLoading: boolean
  onUpdateRow: (rowId: string, payload: Partial<FinancialTransactionRow>) => void
  onRemoveRow: (rowId: string) => void
  onAddRow: () => void
}

export function FinancialTransactionsTable({
  rows,
  isLoading,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
}: FinancialTransactionsTableProps) {
  return (
    <div className="global-subform-table-content flex min-h-0 flex-col">
      <div className="form-table-wrapper">
        <table className="w-full text-xs table-fixed">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="text-center" style={{ width: "15%" }}>Type</th>
              <th className="text-center" style={{ width: "10%" }}>Date</th>
              <th className="text-center" style={{ width: "15%" }}>Payment Type</th>
              <th className="text-center" style={{ width: "15%" }}>Apply To</th>
              <th className="text-center" style={{ width: "10%" }}>Amount</th>
              <th className="text-center" style={{ width: "30%" }}>Description</th>
              <th className="text-center" style={{ width: "8%" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-sm text-muted-foreground" colSpan={7}>
                  No financial transactions added.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td>
                    <Select
                      value={row.transactionType}
                      onValueChange={(value) => onUpdateRow(row.id, { transactionType: value })}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Income">Income</SelectItem>
                        <SelectItem value="Expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <DatePickerInput
                      value={row.transactionDate ?? ""}
                      onChange={(value) => onUpdateRow(row.id, { transactionDate: value })}
                      disabled={isLoading}
                      placeholder="dd-mm-yy"
                      format="dd-mm-yy"
                    />
                  </td>
                  <td>
                    <Select
                      value={row.paymentType}
                      onValueChange={(value) => onUpdateRow(row.id, { paymentType: value })}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <Select
                      value={row.applyTo}
                      onValueChange={(value) => onUpdateRow(row.id, { applyTo: value })}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Advance Payment">Advance Payment</SelectItem>
                        <SelectItem value="Bill Payment">Bill Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={row.transactionAmount ?? 0}
                      onChange={(e) =>
                        onUpdateRow(row.id, { transactionAmount: Number(e.target.value) || 0 })
                      }
                      disabled={isLoading}
                      className="h-10 px-2 text-sm text-center"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="text"
                      placeholder="Optional"
                      value={row.description ?? ""}
                      onChange={(e) => onUpdateRow(row.id, { description: e.target.value })}
                      disabled={isLoading}
                      className="h-10 px-2 text-sm"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveRow(row.id)}
                      disabled={isLoading}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label="Remove transaction row"
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
          Add Financial Transaction
        </Button>
      </div>
    </div>
  )
}

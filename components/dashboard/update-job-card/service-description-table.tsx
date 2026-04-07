import type { MutableRefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import type { ServiceRow } from "./types"

interface ServiceDescriptionTableProps {
  rows: ServiceRow[]
  taxable: boolean
  isDifferentState: boolean
  isLoading: boolean
  serviceRefsMap: MutableRefObject<Map<string, HTMLInputElement>>
  onChange: (rowId: string, field: keyof Omit<ServiceRow, "id">, value: string | number) => void
  onRowFocus: (rowId: string) => void
  onRemoveRow: (rowId: string) => void
  onAddRow: () => void
}

export function ServiceDescriptionTable({
  rows,
  taxable,
  isDifferentState,
  isLoading,
  serviceRefsMap,
  onChange,
  onRowFocus,
  onRemoveRow,
  onAddRow,
}: ServiceDescriptionTableProps) {
  const unitOptions = ["Nos", "Set", "Piece", "Pair", "Litre", "Kg", "Gram", "Meter", "Box", "Pack", "Hour", "Job"]
  return (
    <>
      <div className="form-table-wrapper">
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col style={{ width: "43%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "12%" }} />
            {taxable && <col style={{ width: "10%" }} />}
            {taxable && (isDifferentState ? <col style={{ width: "8%" }} /> : <><col style={{ width: "8%" }} /><col style={{ width: "6%" }} /></>)}
            {taxable && <col style={{ width: "6%" }} />}
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="text-center">Description</th>
              <th className="text-center">Unit</th>
              <th className="text-center">Quantity</th>
              <th className="text-center">Amount</th>
              {taxable && (
                <>
                  <th className="text-center">Total Amount</th>
                  {isDifferentState ? (
                    <th className="text-center">IGST %</th>
                  ) : (
                    <>
                      <th className="text-center">CGST %</th>
                      <th className="text-center">SGST %</th>
                    </>
                  )}
                  <th className="text-center">State Code</th>
                </>
              )}
              <th className="text-center" style={{ width: "8%" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-sm text-muted-foreground" colSpan={taxable ? 10 : 5}>
                  No services added.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t [&>td]:align-middle">
                  <td>
                    <Input
                      name="description"
                      ref={(el) => {
                        if (el) serviceRefsMap.current.set(`${row.id}-description`, el)
                      }}
                      value={row.description ?? ""}
                      onChange={(e) => onChange(row.id, "description", e.target.value)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="h-10 px-3 text-sm text-left"
                    />
                  </td>
                  <td>
                    <Select
                      value={row.unit ?? ""}
                      onValueChange={(value) => onChange(row.id, "unit", value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-10 px-2 text-sm border-0 bg-transparent" aria-label="Unit">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {unitOptions.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u || "-"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <Input
                      type="number"
                      value={row.quantity ?? 0}
                      onChange={(e) => onChange(row.id, "quantity", Number(e.target.value) || 0)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="h-10 px-2 text-sm text-center"
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      ref={(el) => {
                        if (el) serviceRefsMap.current.set(`${row.id}-amount`, el)
                      }}
                      value={row.amount ?? 0}
                      onChange={(e) => onChange(row.id, "amount", Number(e.target.value) || 0)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="h-10 px-2 text-sm text-center"
                    />
                  </td>
                  {taxable && (
                    <td>
                      <Input
                        type="number"
                        value={Number(row.totalAmount || 0).toFixed(2)}
                        readOnly
                        disabled
                        className="h-10 px-2 text-sm text-center bg-muted"
                      />
                    </td>
                  )}
                  {taxable && (
                    <>
                      {isDifferentState ? (
                        <td>
                          <Input
                            type="number"
                            value={row.igstRate ?? 0}
                            onChange={(e) => onChange(row.id, "igstRate", Number(e.target.value) || 0)}
                            onFocus={() => onRowFocus(row.id)}
                            disabled={isLoading}
                            className="h-10 px-2 text-sm text-center"
                          />
                        </td>
                      ) : (
                        <>
                          <td>
                            <Input
                              type="number"
                              value={row.cgstRate ?? 0}
                              onChange={(e) => onChange(row.id, "cgstRate", Number(e.target.value) || 0)}
                              onFocus={() => onRowFocus(row.id)}
                              disabled={isLoading}
                              className="h-10 px-2 text-sm text-center"
                            />
                          </td>
                          <td>
                            <Input
                              type="number"
                              value={row.sgstRate ?? 0}
                              readOnly
                              disabled
                              className="h-10 px-2 text-sm text-center bg-muted"
                              title="SGST is automatically set equal to CGST"
                            />
                          </td>
                        </>
                      )}
                      <td>
                        <Input
                          value={row.stateId ?? ""}
                          onChange={(e) => onChange(row.id, "stateId", e.target.value)}
                          onFocus={() => onRowFocus(row.id)}
                          disabled={isLoading}
                          className="h-10 px-2 text-sm text-center"
                        />
                      </td>
                    </>
                  )}
                  <td className="text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveRow(row.id)}
                      disabled={isLoading}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label="Remove service row"
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
          Add Service
        </Button>
      </div>
    </>
  )
}

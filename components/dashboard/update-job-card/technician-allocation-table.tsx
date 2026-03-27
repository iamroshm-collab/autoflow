import type { MutableRefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import type { TechnicianRow } from "./types"

interface TechnicianAllocationTableProps {
  rows: TechnicianRow[]
  isLoading: boolean
  technicianRefsMap: MutableRefObject<Map<string, HTMLInputElement>>
  onChange: (rowId: string, field: keyof Omit<TechnicianRow, "id">, value: string | number) => void
  onRowFocus: (rowId: string) => void
  onOpenDropdown: (rowId: string) => void
  onRemoveRow: (rowId: string) => void
  onAddRow: () => void
}

export function TechnicianAllocationTable({
  rows,
  isLoading,
  technicianRefsMap,
  onChange,
  onRowFocus,
  onOpenDropdown,
  onRemoveRow,
  onAddRow,
}: TechnicianAllocationTableProps) {
  return (
    <div className="global-subform-table-content flex min-h-0 flex-col">
      <div className="form-table-wrapper">
        <table className="w-full text-xs table-fixed">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="text-center" style={{ width: "24%" }}>Employee Name</th>
              <th className="text-center" style={{ width: "50%" }}>Task Assigned</th>
              <th className="text-center" style={{ width: "20%" }}>Earning</th>
              <th className="text-center" style={{ width: "6%" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-sm text-muted-foreground" colSpan={4}>
                  No technician allocations added.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t [&>td]:align-middle">
                  <td>
                    <Input
                      ref={(el) => {
                        if (el) technicianRefsMap.current.set(`${row.id}-employeeName`, el)
                      }}
                      value={row.employeeName}
                      readOnly
                      onClick={() => onOpenDropdown(row.id)}
                      onFocus={() => onOpenDropdown(row.id)}
                      disabled={isLoading}
                      className="h-10 px-2 text-sm text-center"
                      placeholder="Select employee"
                    />
                  </td>
                  <td>
                    <Input
                      ref={(el) => {
                        if (el) technicianRefsMap.current.set(`${row.id}-taskAssigned`, el)
                      }}
                      value={row.taskAssigned}
                      onChange={(e) => onChange(row.id, "taskAssigned", e.target.value)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="h-10 px-2 text-sm text-center"
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      ref={(el) => {
                        if (el) technicianRefsMap.current.set(`${row.id}-allocationAmount`, el)
                      }}
                      value={row.allocationAmount}
                      onChange={(e) => onChange(row.id, "allocationAmount", e.target.value)}
                      onFocus={() => onRowFocus(row.id)}
                      disabled={isLoading}
                      className="h-10 px-2 text-sm text-center"
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
                      aria-label="Remove technician row"
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
          Add Technician
        </Button>
      </div>
    </div>
  )
}

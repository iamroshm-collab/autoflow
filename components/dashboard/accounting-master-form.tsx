"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from '@/components/ui/notify'
import { Check, ChevronsUpDown, Pencil, Trash2, Plus, X, RotateCcw, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePickerInput } from "@/components/ui/date-picker-input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn, formatDateDDMMYY } from "@/lib/utils"

interface EmployeeOption {
  employeeId: number
  empName: string
  mobile: string
}

interface VehicleOption {
  id: string
  registrationNumber: string
  make: string
  model: string
}

interface LedgerRow {
  id: string
  source: "ledger" | "payroll"
  transactionType: "Income" | "Expense"
  transactionDate: string
  description: string
  vehicle: {
    id: string
    registrationNumber: string
    make: string
    model: string
  } | null
  employee: {
    employeeId: number
    empName: string
    mobile: string
  } | null
  paymentType: string
  transactionAmount: number
  recordTime: string
  payrollTag: string | null
}

const transactionTypes = ["Income", "Expense"] as const
const paymentTypes = ["Cash", "Bank Transfer", "UPI"] as const

const toDateInput = (date = new Date()) => date.toISOString().slice(0, 10)

const toCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0)

interface SearchableSelectProps<T> {
  label: string
  emptyText: string
  options: T[]
  selectedValue: string
  onSelectValue: (value: string) => void
  getOptionValue: (option: T) => string
  getOptionLabel: (option: T) => string
  disabled?: boolean
}

function SearchableSelect<T>({
  label,
  emptyText,
  options,
  selectedValue,
  onSelectValue,
  getOptionValue,
  getOptionLabel,
  disabled,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selectedLabel = useMemo(() => {
    const selected = options.find((option) => getOptionValue(option) === selectedValue)
    return selected ? getOptionLabel(selected) : ""
  }, [options, selectedValue, getOptionLabel, getOptionValue])

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setQuery("")
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[100] w-[var(--radix-popover-trigger-width)] p-0 border-0 bg-transparent shadow-none" align="start">
          <Command>
            <CommandInput value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  key="none"
                  value="none"
                  onSelect={() => {
                    onSelectValue("")
                    setQuery("")
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedValue ? "opacity-0" : "opacity-100")} />
                  None
                </CommandItem>
                {options.map((option) => {
                  const value = getOptionValue(option)
                  const labelValue = getOptionLabel(option)
                  return (
                    <CommandItem
                      key={value}
                      value={`${value} ${labelValue}`}
                      onSelect={() => {
                        onSelectValue(value)
                        setQuery("")
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", selectedValue === value ? "opacity-100" : "opacity-0")}
                      />
                      {labelValue}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface AccountingMasterFormProps {
  searchTerm?: string
  onRecordsCountChange?: (count: number) => void
}

export function AccountingMasterForm({
  searchTerm = "",
  onRecordsCountChange,
}: AccountingMasterFormProps = {}) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])

  const [transactionType, setTransactionType] = useState("")
  const [transactionDate, setTransactionDate] = useState(toDateInput())
  const [description, setDescription] = useState("")
  const [vehicleId, setVehicleId] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [paymentType, setPaymentType] = useState("Cash")
  const [transactionAmount, setTransactionAmount] = useState("")

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [transactionModalMode, setTransactionModalMode] = useState<"add" | "edit">("add")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTransactionType, setEditTransactionType] = useState("")
  const [editTransactionDate, setEditTransactionDate] = useState(toDateInput())
  const [editDescription, setEditDescription] = useState("")
  const [editVehicleId, setEditVehicleId] = useState("")
  const [editEmployeeId, setEditEmployeeId] = useState("")
  const [editPaymentType, setEditPaymentType] = useState("Cash")
  const [editTransactionAmount, setEditTransactionAmount] = useState("")

  const [filterStartDate, setFilterStartDate] = useState("")
  const [filterEndDate, setFilterEndDate] = useState("")
  const [filterTransactionType, setFilterTransactionType] = useState("all")
  const [filterEmployeeId, setFilterEmployeeId] = useState("all")
  const [includePayroll, setIncludePayroll] = useState(false)

  const [rows, setRows] = useState<LedgerRow[]>([])
  const [totals, setTotals] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netProfitLoss: 0,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditSaving, setIsEditSaving] = useState(false)
  const [activeDescriptionRowId, setActiveDescriptionRowId] = useState<string | null>(null)
  const [activeDescriptionText, setActiveDescriptionText] = useState("")

  const showDescriptionToast = (rowId: string, text: string) => {
    if (activeDescriptionRowId === rowId) {
      setActiveDescriptionRowId(null)
      setActiveDescriptionText("")
      return
    }

    setActiveDescriptionRowId(rowId)
    setActiveDescriptionText(text)
  }

  const loadLookups = async () => {
    try {
      const [employeeResponse, vehicleResponse] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/vehicles/master"),
      ])

      const [employeeData, vehicleData] = await Promise.all([
        employeeResponse.json(),
        vehicleResponse.json(),
      ])

      if (!employeeResponse.ok) {
        throw new Error(employeeData.error || "Failed to load employees")
      }

      if (!vehicleResponse.ok) {
        throw new Error(vehicleData.error || "Failed to load vehicles")
      }

      setEmployees(Array.isArray(employeeData) ? employeeData : [])
      setVehicles(Array.isArray(vehicleData) ? vehicleData : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load master data")
      setEmployees([])
      setVehicles([])
    }
  }

  const loadRows = async () => {
    const params = new URLSearchParams()

    if (filterStartDate) params.set("startDate", filterStartDate)
    if (filterEndDate) params.set("endDate", filterEndDate)
    if (filterTransactionType !== "all") params.set("transactionType", filterTransactionType)
    if (filterEmployeeId !== "all") params.set("employeeId", filterEmployeeId)
    params.set("includePayroll", String(includePayroll))

    setIsLoading(true)
    try {
      const response = await fetch(`/api/financial-transactions?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load ledger")
      }

      setRows(Array.isArray(data.rows) ? data.rows : [])
      setTotals({
        totalIncome: Number(data?.totals?.totalIncome || 0),
        totalExpense: Number(data?.totals?.totalExpense || 0),
        netProfitLoss: Number(data?.totals?.netProfitLoss || 0),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load ledger")
      setRows([])
      setTotals({ totalIncome: 0, totalExpense: 0, netProfitLoss: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLookups()
    loadRows()
  }, [])

  useEffect(() => {
    loadRows()
  }, [filterStartDate, filterEndDate, filterTransactionType, filterEmployeeId, includePayroll])

  const resetForm = () => {
    setTransactionType("")
    setTransactionDate(toDateInput())
    setDescription("")
    setVehicleId("")
    setEmployeeId("")
    setPaymentType("Cash")
    setTransactionAmount("")
  }

  const resetEditForm = () => {
    setEditId(null)
    setEditTransactionType("")
    setEditTransactionDate(toDateInput())
    setEditDescription("")
    setEditVehicleId("")
    setEditEmployeeId("")
    setEditPaymentType("Cash")
    setEditTransactionAmount("")
  }

  const clearFilters = () => {
    setFilterStartDate("")
    setFilterEndDate("")
    setFilterTransactionType("all")
    setFilterEmployeeId("all")
    setIncludePayroll(false)
  }

  const handleAddNew = () => {
    resetEditForm()
    setTransactionModalMode("add")
    setIsEditModalOpen(true)
  }

  const handleSave = async () => {
    if (!transactionType) {
      toast.error("Please select transaction type")
      return
    }

    if (Number(transactionAmount || 0) <= 0) {
      toast.error("Transaction amount must be greater than zero")
      return
    }

    if (!description.trim()) {
      toast.error("Description is required")
      return
    }

    if (!transactionDate) {
      toast.error("Transaction date is required")
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        transactionType,
        transactionDate,
        description: description.trim(),
        vehicleId: vehicleId || null,
        employeeId: employeeId ? Number(employeeId) : null,
        paymentType,
        transactionAmount: Number(transactionAmount),
      }

      const response = await fetch("/api/financial-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save transaction")
      }

      toast.success("Transaction added")
      resetForm()
      setIsAddModalOpen(false)
      await loadRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save transaction")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (row: LedgerRow) => {
    if (row.source !== "ledger") return

    setTransactionModalMode("edit")
    setEditId(row.id)
    setEditTransactionType(row.transactionType)
    setEditTransactionDate(new Date(row.transactionDate).toISOString().slice(0, 10))
    setEditDescription(row.description)
    setEditVehicleId(row.vehicle?.id || "")
    setEditEmployeeId(row.employee ? String(row.employee.employeeId) : "")
    setEditPaymentType(row.paymentType)
    setEditTransactionAmount(String(row.transactionAmount || ""))
    setIsEditModalOpen(true)
  }

  const handleEditSave = async () => {
    if (!editTransactionType) {
      toast.error("Please select transaction type")
      return
    }

    if (Number(editTransactionAmount || 0) <= 0) {
      toast.error("Transaction amount must be greater than zero")
      return
    }

    if (!editDescription.trim()) {
      toast.error("Description is required")
      return
    }

    if (!editTransactionDate) {
      toast.error("Transaction date is required")
      return
    }

    setIsEditSaving(true)
    try {
      const payload = {
        transactionType: editTransactionType,
        transactionDate: editTransactionDate,
        description: editDescription.trim(),
        vehicleId: editVehicleId || null,
        employeeId: editEmployeeId ? Number(editEmployeeId) : null,
        paymentType: editPaymentType,
        transactionAmount: Number(editTransactionAmount),
      }

      const response = transactionModalMode === "edit" && editId
        ? await fetch(`/api/financial-transactions/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/financial-transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || (transactionModalMode === "edit" ? "Failed to update transaction" : "Failed to save transaction"))
      }

      toast.success(transactionModalMode === "edit" ? "Transaction updated" : "Transaction added")
      setIsEditModalOpen(false)
      resetEditForm()
      await loadRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (transactionModalMode === "edit" ? "Failed to update transaction" : "Failed to save transaction"))
    } finally {
      setIsEditSaving(false)
    }
  }

  const handleDelete = async (row: LedgerRow) => {
    if (row.source !== "ledger") return

    const confirmDelete = window.confirm("Delete this transaction?")
    if (!confirmDelete) return

    try {
      const response = await fetch(`/api/financial-transactions/${row.id}`, {
        method: "DELETE",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete transaction")
      }

      toast.success("Transaction deleted")
      await loadRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete transaction")
    }
  }

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const displayedRows = useMemo(() => {
    if (!normalizedSearch) {
      return rows
    }

    return rows.filter((row) => {
      const vehicleText = row.vehicle
        ? `${row.vehicle.registrationNumber} ${row.vehicle.make} ${row.vehicle.model}`
        : ""
      const employeeText = row.employee
        ? `${row.employee.employeeId} ${row.employee.empName} ${row.employee.mobile}`
        : ""

      return [
        row.transactionType,
        row.description,
        row.paymentType,
        row.payrollTag || "",
        vehicleText,
        employeeText,
        String(row.transactionAmount || 0),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [normalizedSearch, rows])

  useEffect(() => {
    onRecordsCountChange?.(displayedRows.length)
  }, [displayedRows.length, onRecordsCountChange])

  return (
    <div className="global-subform-table-content flex min-h-0 flex-col">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-muted-foreground">Total Income</p>
          <p className="text-2xl font-semibold text-emerald-600">{toCurrency(totals.totalIncome)}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-semibold text-red-600">{toCurrency(totals.totalExpense)}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-muted-foreground">Net Profit / Loss</p>
          <p className={cn("text-2xl font-semibold", totals.netProfitLoss >= 0 ? "text-emerald-600" : "text-red-600")}>
            {toCurrency(totals.netProfitLoss)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 w-full">
          <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
            <Label>Start Date</Label>
            <DatePickerInput value={filterStartDate} onChange={setFilterStartDate} className="w-full h-10 border border-slate-300 bg-white" />
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
            <Label>End Date</Label>
            <DatePickerInput value={filterEndDate} onChange={setFilterEndDate} className="w-full h-10 border border-slate-300 bg-white" />
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
            <Label>Transaction Type</Label>
            <Select value={filterTransactionType} onValueChange={setFilterTransactionType}>
              <SelectTrigger className="w-full h-10 border border-slate-300 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Income">Income</SelectItem>
                <SelectItem value="Expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <Label>Employee</Label>
            <Select value={filterEmployeeId} onValueChange={setFilterEmployeeId}>
              <SelectTrigger className="w-full h-10 border border-slate-300 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.employeeId} value={String(employee.employeeId)}>
                    {employee.employeeId} - {employee.empName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Action</Label>
            <Button type="button" variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-700" aria-label="Clear Filters">
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
      </div>

      <div className="form-table-wrapper form-table-wrapper--independent-tl accounting-table-wrapper shrink-0">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: "11%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead className="bg-muted/50">
              <tr>
                <th className="text-center p-2">Date</th>
                <th className="text-center p-2">Type</th>
                <th className="text-center p-2">Vehicle</th>
                <th className="text-center p-2">Employee</th>
                <th className="text-center p-2">Payment</th>
                <th className="text-center p-2">Amount</th>
                <th className="text-center p-2">Source</th>
                <th className="text-center p-2">Description</th>
                <th className="text-center p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="p-3 text-muted-foreground text-center" colSpan={9}>
                    Loading transactions...
                  </td>
                </tr>
              ) : displayedRows.length === 0 ? (
                <tr>
                  <td className="p-3 text-muted-foreground text-center" colSpan={9}>
                    No transactions found.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2 text-center">{formatDateDDMMYY(row.transactionDate)}</td>
                    <td className="p-2 text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          row.transactionType === "Income"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {row.transactionType}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      {row.vehicle
                        ? `${row.vehicle.registrationNumber} (${row.vehicle.make} ${row.vehicle.model})`
                        : "-"}
                    </td>
                    <td className="p-2 text-center">
                      {row.employee ? `${row.employee.employeeId} - ${row.employee.empName}` : "-"}
                    </td>
                    <td className="p-2 text-center">{row.paymentType}</td>
                    <td className="p-2 text-center font-medium">{toCurrency(row.transactionAmount)}</td>
                    <td className="p-2 text-center">{row.payrollTag || "Manual"}</td>
                    <td className="p-2">
                      <div className="relative flex items-center justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => showDescriptionToast(row.id, row.description)}
                          aria-label="View description"
                          className="text-slate-600 hover:text-slate-800"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {activeDescriptionRowId === row.id && (
                          <div className="absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 shadow-lg">
                            <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-slate-200 bg-white" />
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</p>
                            <p className="max-h-24 overflow-y-auto break-words">{activeDescriptionText}</p>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(row)}
                          disabled={row.source !== "ledger"}
                          aria-label="Edit"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(row)}
                          disabled={row.source !== "ledger"}
                          aria-label="Delete"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </div>

      <div className="shrink-0">
        <Button
          type="button"
          onClick={handleAddNew}
          className="global-bottom-btn-add"
          variant="ghost"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New
        </Button>
      </div>

      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open)
          if (!open) {
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Add New Ledger Entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Transaction Type</Label>
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transaction Date</Label>
                <DatePickerInput value={transactionDate} onChange={setTransactionDate} />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <SearchableSelect
                label="Vehicle"
                emptyText="No vehicle found"
                options={vehicles}
                selectedValue={vehicleId}
                onSelectValue={setVehicleId}
                getOptionValue={(option) => option.id}
                getOptionLabel={(option) => `${option.registrationNumber} | ${option.make} ${option.model}`}
              />

              <SearchableSelect
                label="Employee"
                emptyText="No employee found"
                options={employees}
                selectedValue={employeeId}
                onSelectValue={setEmployeeId}
                getOptionValue={(option) => String(option.employeeId)}
                getOptionLabel={(option) => `${option.employeeId} - ${option.empName} (${option.mobile})`}
              />

              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transaction Amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={transactionAmount}
                  onChange={(event) => setTransactionAmount(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-5 justify-end pt-4">
            <Button type="button" variant="outline" onClick={resetForm} className="px-4 py-2 min-h-[40px]">
              Clear
            </Button>
            <Button onClick={handleSave} disabled={isSaving} style={{ backgroundColor: '#2563eb', color: 'white' }} className="px-4 py-2 min-h-[40px]">
              <Check className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open)
          if (!open) {
            resetEditForm()
            setTransactionModalMode("add")
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              {transactionModalMode === "edit" ? "Edit Transaction" : "Add New Ledger Entry"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Transaction Type</Label>
                <Select value={editTransactionType} onValueChange={setEditTransactionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transaction Date</Label>
                <DatePickerInput value={editTransactionDate} onChange={setEditTransactionDate} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Input
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </div>

              <SearchableSelect
                label="Vehicle"
                emptyText="No vehicle found"
                options={vehicles}
                selectedValue={editVehicleId}
                onSelectValue={setEditVehicleId}
                getOptionValue={(option) => option.id}
                getOptionLabel={(option) => `${option.registrationNumber} | ${option.make} ${option.model}`}
              />

              <SearchableSelect
                label="Employee"
                emptyText="No employee found"
                options={employees}
                selectedValue={editEmployeeId}
                onSelectValue={setEditEmployeeId}
                getOptionValue={(option) => String(option.employeeId)}
                getOptionLabel={(option) => `${option.employeeId} - ${option.empName} (${option.mobile})`}
              />

              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={editPaymentType} onValueChange={setEditPaymentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transaction Amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editTransactionAmount}
                  onChange={(event) => setEditTransactionAmount(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-5 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false)
                resetEditForm()
                setTransactionModalMode("add")
              }}
              className="px-4 py-2 min-h-[40px]"
            >
              {transactionModalMode === "edit" ? "Cancel" : "Clear"}
            </Button>
            <Button type="button" onClick={handleEditSave} disabled={isEditSaving} style={{ backgroundColor: '#2563eb', color: 'white' }} className="px-4 py-2 min-h-[40px]">
              {isEditSaving
                ? (transactionModalMode === "edit" ? "Updating..." : "Saving...")
                : (transactionModalMode === "edit" ? "Update Transaction" : "Save Transaction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

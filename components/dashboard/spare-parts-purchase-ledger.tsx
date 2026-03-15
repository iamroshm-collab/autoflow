"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil, Trash2, RotateCcw, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShopAutocomplete } from "@/components/ShopAutocomplete"
import { DatePickerInput } from "@/components/ui/date-picker-input"
import { formatDateDDMMYY } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { notify } from "@/components/ui/notify"

interface LedgerRow {
  id: string
  shopName: string
  billDate: string
  billNumber: string
  item: string
  amount: number
  return: boolean
  returnDate: string | null
  returnAmount: number
  paidAmount: number
  paidDate: string | null
}

type NewLedgerRecordDraft = {
  shopName: string
  billDate: string
  billNumber: string
  item: string
  amount: string
  returnAmount: string
  returnDate: string
  paidAmount: string
  paidDate: string
}

const toCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0)

const toInputDate = (value: string | null | undefined) => {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString().slice(0, 10)
}

const getRecordTypeLabel = (row: LedgerRow) => {
  const hasReturn = row.return || Number(row.returnAmount || 0) > 0 || Boolean(row.returnDate)
  const hasPayment = Number(row.paidAmount || 0) > 0 || Boolean(row.paidDate)

  if (hasReturn && hasPayment) return "Return + Payment"
  if (hasReturn) return "Return"
  if (hasPayment) return "Payment"
  return "Purchase"
}

const getRecordTypeClassName = (row: LedgerRow) => {
  const hasReturn = row.return || Number(row.returnAmount || 0) > 0 || Boolean(row.returnDate)
  const hasPayment = Number(row.paidAmount || 0) > 0 || Boolean(row.paidDate)

  if (hasReturn && hasPayment) return "bg-amber-100 text-amber-800"
  if (hasReturn) return "bg-blue-100 text-blue-800"
  if (hasPayment) return "bg-emerald-100 text-emerald-800"
  return "bg-slate-100 text-slate-700"
}

const createNewLedgerRecordDraft = (): NewLedgerRecordDraft => ({
  shopName: "",
  billDate: toInputDate(new Date().toISOString()),
  billNumber: "",
  item: "",
  amount: "0",
  returnAmount: "0",
  returnDate: toInputDate(new Date().toISOString()),
  paidAmount: "0",
  paidDate: toInputDate(new Date().toISOString()),
})

export type SparePartsLedgerTab = "all" | "returned" | "payments"

interface SparePartsPurchaseLedgerProps {
  activeTab?: SparePartsLedgerTab
  shopID: string
  startDate: string
  endDate: string
  onTabChange?: (tab: SparePartsLedgerTab) => void
  onShopFilterChange?: (shop: string) => void
  onStartDateChange?: (date: string) => void
  onEndDateChange?: (date: string) => void
}

export function SparePartsPurchaseLedger({
  activeTab = "all",
  shopID,
  startDate,
  endDate,
  onTabChange,
  onShopFilterChange,
  onStartDateChange,
  onEndDateChange,
}: SparePartsPurchaseLedgerProps) {
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [filteredRows, setFilteredRows] = useState<LedgerRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingReturnRowId, setEditingReturnRowId] = useState<string | null>(null)
  const [editingPaymentRowId, setEditingPaymentRowId] = useState<string | null>(null)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [newReturnDraft, setNewReturnDraft] = useState<NewLedgerRecordDraft>(
    createNewLedgerRecordDraft()
  )
  const [newPaymentDraft, setNewPaymentDraft] = useState<NewLedgerRecordDraft>(
    createNewLedgerRecordDraft()
  )
  const [isCreatingReturn, setIsCreatingReturn] = useState(false)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)

  const updateRow = async (rowId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/spare-parts-ledger/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || "Failed to update record")
    }
  }

  const deleteSubRecord = async (rowId: string, type: "return" | "payment") => {
    const response = await fetch(`/api/spare-parts-ledger/${rowId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || "Failed to delete record")
    }
  }

  const filterData = (selectedShopId: string, fromDate: string, toDate: string) => {
    const selectedShop = selectedShopId.trim().toLowerCase()

    return rows.filter((row) => {
      const rowShop = row.shopName.trim().toLowerCase()
      const rowDate = new Date(row.billDate)

      const shopMatch = selectedShop ? rowShop === selectedShop : true
      const fromMatch = fromDate ? rowDate >= new Date(`${fromDate}T00:00:00`) : true
      const toMatch = toDate ? rowDate <= new Date(`${toDate}T23:59:59`) : true

      return shopMatch && fromMatch && toMatch
    })
  }

  const loadLedger = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/spare-parts-ledger", { cache: "no-store" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load ledger")
      }

      const incomingRows = Array.isArray(data.rows) ? (data.rows as LedgerRow[]) : []
      setRows(incomingRows)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to load ledger")
      setRows([])
      setFilteredRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLedger()
  }, [])

  useEffect(() => {
    setFilteredRows(filterData(shopID, startDate, endDate))
  }, [rows, shopID, startDate, endDate])

  const totalPurchase = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [filteredRows]
  )

  const totalReturn = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.returnAmount || 0), 0),
    [filteredRows]
  )

  const totalPayment = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0),
    [filteredRows]
  )

  const balance = useMemo(
    () => totalPurchase - totalReturn - totalPayment,
    [totalPurchase, totalReturn, totalPayment]
  )

  const returnedRows = useMemo(
    () => filteredRows.filter((row) => row.return || Number(row.returnAmount || 0) > 0),
    [filteredRows]
  )

  const paymentRows = useMemo(
    () => filteredRows.filter((row) => Number(row.paidAmount || 0) > 0 || Boolean(row.paidDate)),
    [filteredRows]
  )

  const formatNumberValue = (value: number | string | undefined | null) =>
    value === null || value === undefined ? "" : String(value)

  const parseAmount = (value: string, fieldName: string) => {
    const parsed = Number(value || "0")
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error(`Invalid ${fieldName}`)
    }
    return parsed
  }

  const createLedgerRecord = async (
    type: "return" | "payment",
    draft: NewLedgerRecordDraft
  ) => {
    const shopName = draft.shopName.trim()
    const billNumber = draft.billNumber.trim()
    const item = draft.item.trim()

    if (!shopName || !billNumber || !item || !draft.billDate) {
      throw new Error("Shop name, bill date, bill number, and item are required")
    }

    const response = await fetch("/api/spare-parts-ledger", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName,
        billDate: new Date(`${draft.billDate}T00:00:00`).toISOString(),
        billNumber,
        item,
        amount: parseAmount(draft.amount, "amount"),
        returnAmount: parseAmount(draft.returnAmount, "return amount"),
        returnDate: draft.returnDate
          ? new Date(`${draft.returnDate}T00:00:00`).toISOString()
          : null,
        paidAmount: parseAmount(draft.paidAmount, "paid amount"),
        paidDate: draft.paidDate
          ? new Date(`${draft.paidDate}T00:00:00`).toISOString()
          : null,
        type,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || "Failed to add placeholder row")
    }

    if (!data.row?.id) {
      throw new Error("Failed to capture created row")
    }

    return data.row as LedgerRow
  }

  const handleCreateReturnRecord = async () => {
    setIsCreatingReturn(true)
    try {
      if (editingReturnRowId) {
        const payload = {
          shopName: newReturnDraft.shopName.trim(),
          billNumber: newReturnDraft.billNumber.trim(),
          itemDescription: newReturnDraft.item.trim(),
          billDate: new Date(`${newReturnDraft.billDate}T00:00:00`).toISOString(),
          amount: parseAmount(newReturnDraft.amount, "amount"),
          returnAmount: parseAmount(newReturnDraft.returnAmount, "return amount"),
          returnDate: newReturnDraft.returnDate
            ? new Date(`${newReturnDraft.returnDate}T00:00:00`).toISOString()
            : null,
          billReturned:
            parseAmount(newReturnDraft.returnAmount, "return amount") > 0 ||
            Boolean(newReturnDraft.returnDate),
        }
        await updateRow(editingReturnRowId, payload)
        notify.success("Returned bill updated")
      } else {
        await createLedgerRecord("return", newReturnDraft)
        notify.success("Returned bill added")
      }
      setIsReturnModalOpen(false)
      setEditingReturnRowId(null)
      setNewReturnDraft(createNewLedgerRecordDraft())
      await loadLedger()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save returned bill")
    } finally {
      setIsCreatingReturn(false)
    }
  }

  const handleCreatePaymentRecord = async () => {
    setIsCreatingPayment(true)
    try {
      if (editingPaymentRowId) {
        const payload = {
          shopName: newPaymentDraft.shopName.trim(),
          billNumber: newPaymentDraft.billNumber.trim(),
          itemDescription: newPaymentDraft.item.trim(),
          billDate: new Date(`${newPaymentDraft.billDate}T00:00:00`).toISOString(),
          amount: parseAmount(newPaymentDraft.amount, "amount"),
          paidAmount: parseAmount(newPaymentDraft.paidAmount, "paid amount"),
          paidDate: newPaymentDraft.paidDate
            ? new Date(`${newPaymentDraft.paidDate}T00:00:00`).toISOString()
            : null,
        }
        await updateRow(editingPaymentRowId, payload)
        notify.success("Bill payment updated")
      } else {
        await createLedgerRecord("payment", newPaymentDraft)
        notify.success("Bill payment added")
      }
      setIsPaymentModalOpen(false)
      setEditingPaymentRowId(null)
      setNewPaymentDraft(createNewLedgerRecordDraft())
      await loadLedger()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save bill payment")
    } finally {
      setIsCreatingPayment(false)
    }
  }

  const handleAddReturnedBill = () => {
    setEditingReturnRowId(null)
    setNewReturnDraft(createNewLedgerRecordDraft())
    setIsReturnModalOpen(true)
  }

  const handleAddBillPayment = () => {
    setEditingPaymentRowId(null)
    setNewPaymentDraft(createNewLedgerRecordDraft())
    setIsPaymentModalOpen(true)
  }

  const handleEditReturnedBill = (row: LedgerRow) => {
    setEditingReturnRowId(row.id)
    setNewReturnDraft({
      shopName: row.shopName || "",
      billDate: toInputDate(row.billDate),
      billNumber: row.billNumber || "",
      item: row.item || "",
      amount: formatNumberValue(row.amount),
      returnAmount: formatNumberValue(row.returnAmount),
      returnDate: toInputDate(row.returnDate),
      paidAmount: formatNumberValue(row.paidAmount),
      paidDate: toInputDate(row.paidDate),
    })
    setIsReturnModalOpen(true)
  }

  const handleEditPayment = (row: LedgerRow) => {
    setEditingPaymentRowId(row.id)
    setNewPaymentDraft({
      shopName: row.shopName || "",
      billDate: toInputDate(row.billDate),
      billNumber: row.billNumber || "",
      item: row.item || "",
      amount: formatNumberValue(row.amount),
      returnAmount: formatNumberValue(row.returnAmount),
      returnDate: toInputDate(row.returnDate),
      paidAmount: formatNumberValue(row.paidAmount),
      paidDate: toInputDate(row.paidDate),
    })
    setIsPaymentModalOpen(true)
  }

  const handleDeleteReturn = async (row: LedgerRow) => {
    const confirmed = window.confirm(`Delete return entry for bill ${row.billNumber}?`)
    if (!confirmed) return

    try {
      await deleteSubRecord(row.id, "return")
      notify.success("Return entry deleted")
      await loadLedger()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to delete return entry")
    }
  }

  const handleDeletePayment = async (row: LedgerRow) => {
    const confirmed = window.confirm(`Delete payment entry for bill ${row.billNumber}?`)
    if (!confirmed) return

    try {
      await deleteSubRecord(row.id, "payment")
      notify.success("Payment entry deleted")
      await loadLedger()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to delete payment entry")
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-border space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sparePartsShopFilter" className="text-xs">
              Shop Name
            </Label>
            <ShopAutocomplete
              inputId="sparePartsShopFilter"
              value={shopID}
              onSelect={(shopName) => onShopFilterChange?.(shopName)}
              onChange={(value) => onShopFilterChange?.(value)}
              inputClassName="h-8 w-full rounded-md border px-3 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="sparePartsFromDate" className="text-xs">
              From Date
            </Label>
            <DatePickerInput
              value={startDate}
              onChange={(date) => onStartDateChange?.(date)}
              format="dd-mm-yy"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="sparePartsToDate" className="text-xs">
              To Date
            </Label>
            <DatePickerInput
              value={endDate}
              onChange={(date) => onEndDateChange?.(date)}
              format="dd-mm-yy"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onShopFilterChange?.("")
              onStartDateChange?.("")
              onEndDateChange?.("")
            }}
            className="text-red-600 hover:text-red-800 h-8 w-8"
            aria-label="Clear Filters"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="bg-blue-50 p-4">
            <p className="text-sm font-medium text-gray-600">Total Purchase</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">{toCurrency(totalPurchase)}</p>
          </Card>
          <Card className="bg-yellow-50 p-4">
            <p className="text-sm font-medium text-gray-600">Total Return</p>
            <p className="mt-2 text-2xl font-bold text-yellow-600">{toCurrency(totalReturn)}</p>
          </Card>
          <Card className="bg-green-50 p-4">
            <p className="text-sm font-medium text-gray-600">Total Payment</p>
            <p className="mt-2 text-2xl font-bold text-green-600">{toCurrency(totalPayment)}</p>
          </Card>
          <Card className="bg-red-50 p-4">
            <p className="text-sm font-medium text-gray-600">Balance</p>
            <p className="mt-2 text-2xl font-bold text-red-600">{toCurrency(balance)}</p>
          </Card>
        </div>

      {activeTab === "all" && (
        <div className="mt-4 space-y-6">
          <h3 className="text-base font-semibold">Ledger Records</h3>
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="sticky top-0 z-20">
                  <tr className="h-16 bg-slate-100">
                    <th className="text-center p-2" style={{ width: "9%" }}>Type</th>
                    <th className="text-center p-2" style={{ width: "12%" }}>Shop Name</th>
                    <th className="text-center p-2" style={{ width: "10%" }}>Bill Date</th>
                    <th className="text-center p-2" style={{ width: "11%" }}>Bill Number</th>
                    <th className="text-center p-2" style={{ width: "26%" }}>Item</th>
                    <th className="text-center p-2" style={{ width: "10%" }}>Amount</th>
                    <th className="text-center p-2" style={{ width: "8%" }}>Return</th>
                    <th className="text-center p-2" style={{ width: "10%" }}>Return Date</th>
                    <th className="text-center p-2" style={{ width: "7%" }}>Return Amount</th>
                    <th className="text-center p-2" style={{ width: "7%" }}>Paid Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="p-3 text-muted-foreground">
                        Loading ledger data...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-3 text-muted-foreground">
                        No records found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="h-14">
                        <td className="p-2 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRecordTypeClassName(row)}`}
                          >
                            {getRecordTypeLabel(row)}
                          </span>
                        </td>
                        <td className="p-2 text-center">{row.shopName}</td>
                        <td className="p-2 text-center">{formatDateDDMMYY(row.billDate) || "-"}</td>
                        <td className="p-2 text-center">{row.billNumber}</td>
                        <td className="p-2 text-center">{row.item}</td>
                        <td className="p-2 text-center">{toCurrency(row.amount)}</td>
                        <td className="p-2 text-center">{row.return ? "Yes" : "No"}</td>
                        <td className="p-2 text-center">
                          {formatDateDDMMYY(row.returnDate) || "-"}
                        </td>
                        <td className="p-2 text-center">{toCurrency(row.returnAmount)}</td>
                        <td className="p-2 text-center">{toCurrency(row.paidAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "returned" && (
        <div className="mt-4 space-y-4">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-100">
                    <th className="text-center p-2" style={{ width: "16%" }}>Shop Name</th>
                    <th className="text-center p-2" style={{ width: "12%" }}>Bill Date</th>
                    <th className="text-center p-2" style={{ width: "14%" }}>Bill Number</th>
                    <th className="text-center p-2" style={{ width: "26%" }}>Item</th>
                    <th className="text-center p-2" style={{ width: "12%" }}>Return Date</th>
                    <th className="text-center p-2" style={{ width: "10%" }}>Return Amount</th>
                    <th className="text-center p-2" style={{ width: "10%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-3 text-muted-foreground">
                        Loading returned bills...
                      </td>
                    </tr>
                  ) : returnedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-3 text-muted-foreground">
                        No returned bills found.
                      </td>
                    </tr>
                  ) : (
                    returnedRows.map((row) => {
                      return (
                        <tr key={row.id}>
                          <td className="p-2 text-center">{row.shopName || "-"}</td>
                          <td className="p-2 text-center">{formatDateDDMMYY(row.billDate) || "-"}</td>
                          <td className="p-2 text-center">{row.billNumber || "-"}</td>
                          <td className="p-2 text-center">{row.item || "-"}</td>
                          <td className="p-2 text-center">{formatDateDDMMYY(row.returnDate) || "-"}</td>
                          <td className="p-2 text-center">{toCurrency(row.returnAmount)}</td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit return for bill ${row.billNumber}`}
                                onClick={() => handleEditReturnedBill(row)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-800"
                                aria-label={`Delete return for bill ${row.billNumber}`}
                                onClick={() => handleDeleteReturn(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="sticky-form-actions">
            <Button
              type="button"
              className="w-full border border-dashed border-emerald-500 text-emerald-500 hover:bg-green-50 bg-transparent px-3 py-2 rounded-md text-sm"
              variant="ghost"
              onClick={handleAddReturnedBill}
              disabled={isCreatingReturn}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Returned Bill
            </Button>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="mt-4 space-y-4">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-100">
                    <th className="text-center p-2" style={{ width: "12%" }}>Shop Name</th>
                    <th className="text-center p-2" style={{ width: "14%" }}>Bill Date</th>
                    <th className="text-center p-2" style={{ width: "14%" }}>Bill Number</th>
                    <th className="text-center p-2" style={{ width: "26%" }}>Item</th>
                    <th className="text-center p-2" style={{ width: "14%" }}>Paid Date</th>
                    <th className="text-center p-2" style={{ width: "10%" }}>Paid Amount</th>
                    <th className="text-center p-2" style={{ width: "10%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-3 text-muted-foreground">
                        Loading bill payments...
                      </td>
                    </tr>
                  ) : paymentRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-3 text-muted-foreground">
                        No bill payments found.
                      </td>
                    </tr>
                  ) : (
                    paymentRows.map((row) => {
                      return (
                        <tr key={row.id}>
                          <td className="p-2 text-center">{row.shopName || "-"}</td>
                          <td className="p-2 text-center">{formatDateDDMMYY(row.billDate) || "-"}</td>
                          <td className="p-2 text-center">{row.billNumber || "-"}</td>
                          <td className="p-2 text-center">{row.item || "-"}</td>
                          <td className="p-2 text-center">{formatDateDDMMYY(row.paidDate) || "-"}</td>
                          <td className="p-2 text-center">{toCurrency(row.paidAmount)}</td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit payment for bill ${row.billNumber}`}
                                onClick={() => handleEditPayment(row)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-800"
                                aria-label={`Delete payment for bill ${row.billNumber}`}
                                onClick={() => handleDeletePayment(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="sticky-form-actions">
            <Button
              type="button"
              className="w-full border border-dashed border-emerald-500 text-emerald-500 hover:bg-green-50 bg-transparent px-3 py-2 rounded-md text-sm"
              variant="ghost"
              onClick={handleAddBillPayment}
              disabled={isCreatingPayment}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Bill Payment
            </Button>
          </div>
        </div>
      )}
      </div>

      <Dialog
        open={isReturnModalOpen}
        onOpenChange={(open) => {
          setIsReturnModalOpen(open)
          if (!open) setEditingReturnRowId(null)
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              {editingReturnRowId ? "Edit Returned Bill" : "Add Returned Bill"}
            </DialogTitle>
            <DialogDescription>
              {editingReturnRowId
                ? "Update the returned bill details and save changes."
                : "Enter the returned bill details to create a new ledger record."}
            </DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 items-start">
              <div className="space-y-2">
                <Label htmlFor="ret-shop-name">Shop Name *</Label>
                <ShopAutocomplete
                  inputId="ret-shop-name"
                  value={newReturnDraft.shopName}
                  onSelect={(shopName) =>
                    setNewReturnDraft((prev) => ({ ...prev, shopName }))
                  }
                  onChange={(value) =>
                    setNewReturnDraft((prev) => ({ ...prev, shopName: value }))
                  }
                  disabled={isCreatingReturn}
                  inputClassName="h-10 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ret-bill-date">Bill Date *</Label>
                <DatePickerInput
                  id="ret-bill-date"
                  value={newReturnDraft.billDate}
                  onChange={(date) =>
                    setNewReturnDraft((prev) => ({ ...prev, billDate: date }))
                  }
                  format="iso"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ret-bill-number">Bill Number *</Label>
                <Input
                  id="ret-bill-number"
                  value={newReturnDraft.billNumber}
                  onChange={(event) =>
                    setNewReturnDraft((prev) => ({ ...prev, billNumber: event.target.value }))
                  }
                  placeholder="Enter bill number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ret-item">Item *</Label>
                <Input
                  id="ret-item"
                  value={newReturnDraft.item}
                  onChange={(event) =>
                    setNewReturnDraft((prev) => ({ ...prev, item: event.target.value }))
                  }
                  placeholder="Enter item description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ret-return-date">Return Date</Label>
                <DatePickerInput
                  id="ret-return-date"
                  value={newReturnDraft.returnDate}
                  onChange={(date) =>
                    setNewReturnDraft((prev) => ({ ...prev, returnDate: date }))
                  }
                  format="iso"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ret-return-amount">Return Amount</Label>
                <Input
                  id="ret-return-amount"
                  type="number"
                  step="0.01"
                  value={newReturnDraft.returnAmount}
                  onChange={(event) =>
                    setNewReturnDraft((prev) => ({ ...prev, returnAmount: event.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-5 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsReturnModalOpen(false)
                setEditingReturnRowId(null)
              }}
              disabled={isCreatingReturn}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateReturnRecord}
              disabled={isCreatingReturn}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {isCreatingReturn
                ? "Saving..."
                : editingReturnRowId
                  ? "Update Returned Bill"
                  : "Save Returned Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={(open) => {
          setIsPaymentModalOpen(open)
          if (!open) setEditingPaymentRowId(null)
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              {editingPaymentRowId ? "Edit Bill Payment" : "Add Bill Payment"}
            </DialogTitle>
            <DialogDescription>
              {editingPaymentRowId
                ? "Update the payment details and save changes."
                : "Enter the payment details to create a new ledger record."}
            </DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 items-start">
              <div className="space-y-2">
                <Label htmlFor="pay-shop-name">Shop Name *</Label>
                <ShopAutocomplete
                  inputId="pay-shop-name"
                  value={newPaymentDraft.shopName}
                  onSelect={(shopName) =>
                    setNewPaymentDraft((prev) => ({ ...prev, shopName }))
                  }
                  onChange={(value) =>
                    setNewPaymentDraft((prev) => ({ ...prev, shopName: value }))
                  }
                  disabled={isCreatingPayment}
                  inputClassName="h-10 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-bill-date">Bill Date *</Label>
                <DatePickerInput
                  id="pay-bill-date"
                  value={newPaymentDraft.billDate}
                  onChange={(date) =>
                    setNewPaymentDraft((prev) => ({ ...prev, billDate: date }))
                  }
                  format="iso"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-bill-number">Bill Number *</Label>
                <Input
                  id="pay-bill-number"
                  value={newPaymentDraft.billNumber}
                  onChange={(event) =>
                    setNewPaymentDraft((prev) => ({ ...prev, billNumber: event.target.value }))
                  }
                  placeholder="Enter bill number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-item">Item *</Label>
                <Input
                  id="pay-item"
                  value={newPaymentDraft.item}
                  onChange={(event) =>
                    setNewPaymentDraft((prev) => ({ ...prev, item: event.target.value }))
                  }
                  placeholder="Enter item description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-paid-date">Paid Date</Label>
                <DatePickerInput
                  id="pay-paid-date"
                  value={newPaymentDraft.paidDate}
                  onChange={(date) =>
                    setNewPaymentDraft((prev) => ({ ...prev, paidDate: date }))
                  }
                  format="iso"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pay-paid-amount">Paid Amount</Label>
                <Input
                  id="pay-paid-amount"
                  type="number"
                  step="0.01"
                  value={newPaymentDraft.paidAmount}
                  onChange={(event) =>
                    setNewPaymentDraft((prev) => ({ ...prev, paidAmount: event.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-5 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsPaymentModalOpen(false)
                setEditingPaymentRowId(null)
              }}
              disabled={isCreatingPayment}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreatePaymentRecord}
              disabled={isCreatingPayment}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {isCreatingPayment
                ? "Saving..."
                : editingPaymentRowId
                  ? "Update Bill Payment"
                  : "Save Bill Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

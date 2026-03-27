"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { notify } from "@/components/ui/notify"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatDateToISODate, getTodayISODateInIndia, parseISODateToLocalDate } from "@/lib/utils"

interface FinancialTransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicleRegistration: string
  vehicleMake: string
  customerName: string
  mobileNumber: string
  vehicleId?: string
  jobCardId?: string
  onSave: (data: FinancialTransactionData) => Promise<void>
}

export interface FinancialTransactionData {
  vehicleRegistration: string
  vehicleMake: string
  customerName: string
  mobileNumber: string
  transactionType: string
  transactionDate: string
  paymentType: string
  description: string
  transactionAmount: number
  applyTo: "Advance Payment" | "Bill Payment"
  paid: number
  advance: number
  mode: "create" | "update"
  transactionId?: number
  vehicleId?: string
  jobCardId?: string
}

interface FinancialTransactionRecord {
  id: string
  transactionType: string
  transactionDate: string
  paymentType: string
  description: string
  transactionAmount: number
}

const PAYMENT_TYPE_OPTIONS = ["Cash", "Bank Transfer", "UPI"]
const APPLY_TO_OPTIONS: Array<"Advance Payment" | "Bill Payment"> = [
  "Advance Payment",
  "Bill Payment",
]

export function FinancialTransactionModal({
  open,
  onOpenChange,
  vehicleRegistration,
  vehicleMake,
  customerName,
  mobileNumber,
  vehicleId,
  jobCardId,
  onSave,
}: FinancialTransactionModalProps) {
  const today = getTodayISODateInIndia()

  const [formData, setFormData] = useState({
    vehicleRegistration,
    vehicleMake,
    customerName,
    mobileNumber,
    transactionType: "",
    transactionDate: today,
    paymentType: "",
    description: "",
    transactionAmount: 0,
    applyTo: "" as "Advance Payment" | "Bill Payment" | "",
    paid: 0,
    advance: 0,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [transactions, setTransactions] = useState<FinancialTransactionRecord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const currentTransaction = useMemo(
    () => (currentIndex >= 0 && transactions.length > 0 ? transactions[currentIndex] : null),
    [transactions, currentIndex]
  )

  const formatDateInput = (value: string) => {
    const parsed = parseISODateToLocalDate(value) || new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return ""
    }
    return formatDateToISODate(parsed)
  }

  const resetForm = () => {
    const today = getTodayISODateInIndia()
    setFormData({
      vehicleRegistration,
      vehicleMake,
      customerName,
      mobileNumber,
      transactionType: "",
      transactionDate: today,
      paymentType: "",
      description: "",
      transactionAmount: 0,
      applyTo: "" as "Advance Payment" | "Bill Payment" | "",
      paid: 0,
      advance: 0,
    })
  }

  const applyTransactionToForm = (transaction: FinancialTransactionRecord | null) => {
    if (!transaction) {
      resetForm()
      return
    }

    setFormData((prev) => ({
      ...prev,
      transactionType: transaction.transactionType,
      transactionDate: formatDateInput(transaction.transactionDate),
      paymentType: transaction.paymentType,
      description: transaction.description || "",
      transactionAmount: Number(transaction.transactionAmount || 0),
      applyTo: prev.applyTo || "Bill Payment",
    }))
  }

  const fetchTransactions = async () => {
    if (!jobCardId) {
      setTransactions([])
      setCurrentIndex(0)
      return
    }

    try {
      const response = await fetch(
        `/api/financial-transactions?jobCardId=${encodeURIComponent(jobCardId)}`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load transactions")
      }

      const rows = Array.isArray(data.rows) ? data.rows : []
      setTransactions(rows)
      setCurrentIndex(-1)
      resetForm()
    } catch (error) {
      console.error("Error loading transactions:", error)
      setTransactions([])
      setCurrentIndex(-1)
      resetForm()
    }
  }

  useEffect(() => {
    if (open) {
      fetchTransactions()
    }
  }, [open, jobCardId])

  useEffect(() => {
    if (!open) {
      return
    }
    applyTransactionToForm(currentTransaction)
  }, [currentTransaction, open])

  const validateForm = (): boolean => {
    // Check for required fields: Transaction Type, Payment Type, Apply To, Transaction Amount, Transaction Date
    if (!formData.transactionType || formData.transactionType.trim() === "") {
      notify.warn("Transaction Type is required")
      return false
    }

    if (!formData.transactionDate || formData.transactionDate.trim() === "") {
      notify.warn("Transaction Date is required")
      return false
    }

    if (!formData.paymentType || formData.paymentType.trim() === "") {
      notify.warn("Payment Type is required")
      return false
    }

    if (!formData.applyTo || formData.applyTo.trim() === "") {
      notify.warn("Apply To is required")
      return false
    }

    if (!formData.transactionAmount || formData.transactionAmount <= 0) {
      notify.warn("Transaction Amount is required and must be greater than 0")
      return false
    }

    return true
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      const mode = currentTransaction ? "update" : "create"
      const transactionId = currentTransaction ? Number(currentTransaction.id) : undefined

      await onSave({
        vehicleRegistration,
        vehicleMake,
        customerName,
        mobileNumber,
        transactionType: formData.transactionType,
        transactionDate: formData.transactionDate,
        paymentType: formData.paymentType,
        description: formData.description,
        transactionAmount: formData.transactionAmount,
        applyTo: formData.applyTo as "Bill Payment" | "Advance Payment",
        paid: formData.paid,
        advance: formData.advance,
        mode,
        transactionId,
        vehicleId,
        jobCardId,
      })

      notify.success(
        mode === "update"
          ? "Financial transaction updated successfully"
          : "Financial transaction created successfully"
      )

      resetForm()
      await fetchTransactions()
      setCurrentIndex(-1)
    } catch (error) {
      console.error("Error saving financial transaction:", error)
      notify.error(error instanceof Error ? error.message : "Failed to save transaction")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
      setTransactions([])
      setCurrentIndex(-1)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl font-semibold">Financial Transactions</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCurrentIndex((prev) => prev - 1)}
                disabled={currentIndex <= -1}
                aria-label="Previous transaction"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                {transactions.length === 0
                  ? "1 of 1"
                  : currentIndex === -1
                    ? `${transactions.length + 1} of ${transactions.length + 1}`
                    : `${currentIndex + 1} of ${transactions.length + 1}`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentIndex((prev) => (prev === -1 ? 0 : Math.min(prev + 1, transactions.length - 1)))
                }
                disabled={transactions.length === 0 || (currentIndex >= 0 && currentIndex >= transactions.length - 1)}
                aria-label="Next transaction"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="border border-slate-200 rounded-lg bg-white p-3 md:p-6 space-y-3 md:space-y-4">
          {/* 5 Columns x 3 Rows Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {/* Row 1 */}
            <div className="grid gap-2">
              <Label htmlFor="reg">Vehicle Registration</Label>
              <Input
                id="reg"
                value={vehicleRegistration}
                readOnly
                className="h-10 bg-muted text-center"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="make">Vehicle Make</Label>
              <Input
                id="make"
                value={vehicleMake}
                readOnly
                className="h-10 bg-muted text-center"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer">Customer Name</Label>
              <Input
                id="customer"
                value={customerName}
                readOnly
                className="h-10 bg-muted text-center"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input
                id="mobile"
                value={mobileNumber}
                readOnly
                className="h-10 bg-muted text-center"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transactionDate" className="font-semibold">Transaction Date</Label>
              <Input
                id="transactionDate"
                type="date"
                value={formData.transactionDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transactionDate: e.target.value,
                  }))
                }
                disabled={isLoading}
                className="h-10 text-center border border-gray-300 bg-muted/30"
              />
            </div>

            {/* Row 2 */}
            <div className="grid gap-2">
              <Label htmlFor="transactionType" className="font-semibold">Transaction Type</Label>
              <Select
                value={formData.transactionType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, transactionType: value }))
                }
                disabled={isLoading}
              >
                <SelectTrigger id="transactionType" className="h-10 text-center border border-gray-300 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Income">Income</SelectItem>
                  <SelectItem value="Expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentType" className="font-semibold">Payment Type</Label>
              <Select
                value={formData.paymentType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, paymentType: value }))
                }
                disabled={isLoading}
              >
                <SelectTrigger id="paymentType" className="h-10 text-center border border-gray-300 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="applyTo" className="font-semibold">Apply To</Label>
              <Select
                value={formData.applyTo}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    applyTo: value as "Advance Payment" | "Bill Payment",
                  }))
                }
                disabled={isLoading}
              >
                <SelectTrigger id="applyTo" className="h-10 text-center border border-gray-300 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLY_TO_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount" className="font-semibold">Transaction Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={formData.transactionAmount || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transactionAmount: Number(e.target.value) || 0,
                  }))
                }
                disabled={isLoading}
                className="h-10 text-center border border-gray-300 bg-muted/30"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paid" className="font-semibold">Paid</Label>
              <Input
                id="paid"
                type="number"
                placeholder="0.00"
                value={formData.paid || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    paid: Number(e.target.value) || 0,
                  }))
                }
                disabled={isLoading}
                className="h-10 text-center border border-gray-300 bg-muted/30"
              />
            </div>

            {/* Row 3 */}
            <div className="grid gap-2">
              <Label htmlFor="advance" className="font-semibold">Advance</Label>
              <Input
                id="advance"
                type="number"
                placeholder="0.00"
                value={formData.advance || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    advance: Number(e.target.value) || 0,
                  }))
                }
                disabled={isLoading}
                className="h-10 text-center border border-gray-300 bg-muted/30"
              />
            </div>
            <div className="col-span-4 grid gap-2">
              <Label htmlFor="description" className="font-semibold">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Enter description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                disabled={isLoading}
                className="h-10 text-center border border-gray-300 bg-muted/30"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-5 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm()
              onOpenChange(false)
            }}
            disabled={isLoading}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

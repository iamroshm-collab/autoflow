"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import DatePickerInput from "@/components/ui/date-picker-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/notify"
import { Pencil, Plus, Save, Search, Trash2 } from "lucide-react"
import useContinuousRows from "@/components/hooks/useContinuousRows"
import { formatDateDDMMYY, getTodayISODateInIndia, parseDDMMYYToISO } from "@/lib/utils"

type Supplier = { supplierId: number; supplierName: string }
type Product = { productId: number; productName: string; purchasePrice: number }

type PurchaseRow = {
  id: string
  productId?: number
  quantity: number
  unitPrice: number
}

type PurchaseRecord = {
  purchaseId: number
  supplierId: number
  supplier?: string
  refDocument?: string
  billNumber?: string
  purchaseDate?: string
  purchaseDetails?: Array<{
    purchaseDetailsId?: number
    productId: number
    product?: string
    qnty?: number
    purchasePrice?: number
  }>
}

const todayDDMMYY = () => formatDateDDMMYY(getTodayISODateInIndia())

const makeRow = (): PurchaseRow => ({
  id: `row-${Date.now()}-${Math.random()}`,
  quantity: 0,
  unitPrice: 0,
})

const rowTotal = (row: PurchaseRow) => Number((Number(row.quantity || 0) * Number(row.unitPrice || 0)).toFixed(2))

export default function PurchaseEntryForm() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [purchaseDate, setPurchaseDate] = useState<string>(todayDDMMYY())
  const [billNumber, setBillNumber] = useState<string>("")
  const [purchaseId, setPurchaseId] = useState<number | null>(null)

  const { rows, setRows, updateRow, removeRow } = useContinuousRows<PurchaseRow>(makeRow, [], { autoAppend: false })

  const [isSaving, setIsSaving] = useState(false)

  const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false)
  const [newSupplierId, setNewSupplierId] = useState<string>("")
  const [newSupplierQuery, setNewSupplierQuery] = useState<string>("")
  const [isNewSupplierDropdownOpen, setIsNewSupplierDropdownOpen] = useState(false)
  const [newBillNumber, setNewBillNumber] = useState<string>("")
  const [newPurchaseDate, setNewPurchaseDate] = useState<string>(todayDDMMYY())
  const [isHeaderPrepared, setIsHeaderPrepared] = useState(false)
  const newSupplierDropdownRef = useRef<HTMLDivElement | null>(null)

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<PurchaseRecord[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)
  const [priceProduct, setPriceProduct] = useState<Product | null>(null)
  const [priceValue, setPriceValue] = useState("")

  useEffect(() => {
    void fetchSuppliers()
  }, [])

  useEffect(() => {
    if (selectedSupplier?.supplierId) {
      void fetchProducts(selectedSupplier.supplierId)
    } else {
      setProducts([])
    }
  }, [selectedSupplier])

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!newSupplierDropdownRef.current?.contains(event.target as Node)) {
        setIsNewSupplierDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [])

  const filteredNewSuppliers = useMemo(() => {
    const query = newSupplierQuery.trim().toLowerCase()
    if (!query) return suppliers
    return suppliers.filter((supplier) => supplier.supplierName.toLowerCase().includes(query))
  }, [newSupplierQuery, suppliers])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/inventory/suppliers")
      const data = await response.json()
      setSuppliers(Array.isArray(data) ? data : [])
    } catch {
      setSuppliers([])
    }
  }

  const fetchProducts = async (supplierId: number) => {
    try {
      const response = await fetch(`/api/inventory/products?supplierId=${supplierId}`)
      const data = await response.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch {
      setProducts([])
    }
  }

  const clearForm = () => {
    setSelectedSupplier(null)
    setPurchaseDate(todayDDMMYY())
    setBillNumber("")
    setPurchaseId(null)
    setRows([])
  }

  const loadPurchaseById = async (id: number): Promise<PurchaseRecord | null> => {
    try {
      const response = await fetch(`/api/purchases?id=${id}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load purchase")
      }
      return data as PurchaseRecord
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load purchase")
      return null
    }
  }

  const applyPurchaseToForm = async (purchase: PurchaseRecord) => {
    const supplierName = String(purchase.supplier || "")
    const supplierFromList = suppliers.find((s) => s.supplierId === purchase.supplierId)

    setSelectedSupplier(
      supplierFromList || {
        supplierId: purchase.supplierId,
        supplierName,
      }
    )

    setPurchaseId(Number(purchase.purchaseId))
    setBillNumber(String(purchase.refDocument || purchase.billNumber || ""))
    setPurchaseDate(purchase.purchaseDate ? formatDateDDMMYY(String(purchase.purchaseDate).slice(0, 10)) : todayDDMMYY())

    const detailRows = Array.isArray(purchase.purchaseDetails)
      ? purchase.purchaseDetails.map((detail) => ({
          id: detail.purchaseDetailsId
            ? `detail-${detail.purchaseDetailsId}`
            : `detail-${Date.now()}-${Math.random()}`,
          productId: Number(detail.productId),
          quantity: Number(detail.qnty || 0),
          unitPrice: Number(detail.purchasePrice || 0),
        }))
      : []

    setRows(detailRows)

    if (purchase.supplierId) {
      await fetchProducts(purchase.supplierId)
    }
  }

  const savePurchase = async (): Promise<boolean> => {
    if (!selectedSupplier) {
      toast.error("Please select a supplier")
      return false
    }

    if (!billNumber.trim()) {
      toast.error("Please enter bill number")
      return false
    }

    if (!purchaseDate) {
      toast.error("Please enter purchase date")
      return false
    }

    const purchaseDateISO = parseDDMMYYToISO(purchaseDate)
    if (!purchaseDateISO) {
      toast.error("Enter purchase date in dd-mm-yy format")
      return false
    }

    const details = rows
      .filter((row) => Number.isInteger(row.productId) && Number(row.quantity) > 0)
      .map((row) => ({
        productId: Number(row.productId),
        qnty: Number(row.quantity),
        purchasePrice: Number(row.unitPrice || 0),
      }))

    if (details.length === 0) {
      toast.error("Add at least one product row with quantity")
      return false
    }

    const payload = {
      purchaseDate: purchaseDateISO,
      supplierId: selectedSupplier.supplierId,
      refDocument: billNumber.trim(),
      billNumber: billNumber.trim(),
      details,
    }

    const method = purchaseId ? "PUT" : "POST"
    const url = purchaseId ? `/api/purchases/${purchaseId}` : "/api/purchases"

    setIsSaving(true)
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save purchase")
      }

      toast.success(purchaseId ? "Purchase updated" : "Purchase saved")

      if (!purchaseId && data?.purchaseId) {
        setPurchaseId(Number(data.purchaseId))
      }

      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save purchase")
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreatePurchaseHeader = () => {
    const supplierId = Number(newSupplierId)
    const supplier = suppliers.find((item) => item.supplierId === supplierId)

    if (!supplier) {
      toast.error("Please select supplier")
      return
    }

    if (!newBillNumber.trim()) {
      toast.error("Please enter bill number")
      return
    }

    if (!newPurchaseDate) {
      toast.error("Please enter purchase date")
      return
    }

    const newPurchaseDateISO = parseDDMMYYToISO(newPurchaseDate)
    if (!newPurchaseDateISO) {
      toast.error("Enter bill date in dd-mm-yy format")
      return
    }

    setSelectedSupplier(supplier)
    setBillNumber(newBillNumber.trim())
    setPurchaseDate(formatDateDDMMYY(newPurchaseDateISO))
    setPurchaseId(null)
    setRows((prev) => (prev.length > 0 ? prev : [makeRow()]))
    setIsHeaderPrepared(true)
  }

  const handleSelectNewSupplier = (supplier: Supplier) => {
    setNewSupplierId(String(supplier.supplierId))
    setNewSupplierQuery(supplier.supplierName)
    setIsNewSupplierDropdownOpen(false)
  }

  const updateProductForRow = (rowId: string, productId: number | undefined) => {
    const product = products.find((item) => item.productId === productId)
    if (!product) {
      updateRow(rowId, { productId: undefined, unitPrice: 0 })
      return
    }

    updateRow(rowId, {
      productId: product.productId,
      unitPrice: Number(product.purchasePrice || 0),
    })
  }

  const addProductRow = () => {
    if (!selectedSupplier) {
      toast.error("Create or load a purchase first")
      return
    }
    setRows((prev) => [...prev, makeRow()])
  }

  const openPriceEditor = (row: PurchaseRow) => {
    const product = products.find((item) => item.productId === row.productId)
    if (!product) {
      toast.error("Select product first")
      return
    }
    setPriceProduct(product)
    setPriceValue(String(product.purchasePrice || 0))
    setIsPriceModalOpen(true)
  }

  const submitPriceChange = async () => {
    if (!priceProduct) return

    const newPrice = Number(priceValue)
    if (Number.isNaN(newPrice) || newPrice < 0) {
      toast.error("Enter a valid price")
      return
    }

    try {
      const response = await fetch("/api/inventory/products/price", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: priceProduct.productId, newPrice }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update price")
      }

      toast.success("Product price updated")

      setProducts((prev) =>
        prev.map((product) =>
          product.productId === priceProduct.productId ? { ...product, purchasePrice: newPrice } : product
        )
      )

      setRows((prev) =>
        prev.map((row) =>
          row.productId === priceProduct.productId ? { ...row, unitPrice: newPrice } : row
        )
      )

      setIsPriceModalOpen(false)
      setPriceProduct(null)
      setPriceValue("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update price")
    }
  }

  const searchPurchases = async (query: string) => {
    setIsSearching(true)
    try {
      const endpoint = query.trim()
        ? `/api/purchases?bill=${encodeURIComponent(query.trim())}`
        : "/api/purchases"
      const response = await fetch(endpoint)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to search purchases")
      }
      setSearchResults(Array.isArray(data) ? (data as PurchaseRecord[]) : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to search purchases")
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const openSearchDialog = async () => {
    setSearchQuery("")
    setSearchResults([])
    setIsSearchModalOpen(true)
    await searchPurchases("")
  }

  const openEditForPurchase = async (purchase: PurchaseRecord) => {
    const full = await loadPurchaseById(purchase.purchaseId)
    if (!full) return
    await applyPurchaseToForm(full)
    setIsSearchModalOpen(false)
    setIsEditModalOpen(true)
  }

  const loadPurchaseToMain = async (purchase: PurchaseRecord) => {
    const full = await loadPurchaseById(purchase.purchaseId)
    if (!full) return
    await applyPurchaseToForm(full)
    setIsSearchModalOpen(false)
  }

  const canOpenEditModal = Boolean(selectedSupplier && billNumber.trim())

  const tableRows = rows.length ? rows : []

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold">Inventory Purchase Entry</h2>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={openSearchDialog}>
              <Search className="h-4 w-4 mr-2" />
              Search Bill
            </Button>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm min-w-[980px] table-fixed">
            <thead className="bg-slate-100/80">
              <tr>
                <th className="text-left font-medium px-3 py-2" style={{ width: "42%" }}>Product</th>
                <th className="text-left font-medium px-3 py-2" style={{ width: "9%" }}>Qty</th>
                <th className="text-left font-medium px-3 py-2" style={{ width: "15%" }}>Unit Price</th>
                <th className="text-center font-medium px-3 py-2" style={{ width: "11%" }}>Edit Unit Price</th>
                <th className="text-left font-medium px-3 py-2" style={{ width: "14%" }}>Total</th>
                <th className="text-center font-medium px-3 py-2" style={{ width: "9%" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Click New Purchase below to start with supplier, bill number, and date.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">
                      <select
                        value={row.productId ?? ""}
                        onChange={(event) =>
                          updateProductForRow(row.id, event.target.value ? Number(event.target.value) : undefined)
                        }
                        className="h-9 w-full rounded border border-input bg-background px-2"
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.productId} value={product.productId}>
                            {product.productName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        value={row.quantity}
                        onChange={(event) => updateRow(row.id, { quantity: Number(event.target.value || 0) })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        value={row.unitPrice}
                        onChange={(event) => updateRow(row.id, { unitPrice: Number(event.target.value || 0) })}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openPriceEditor(row)}
                        aria-label="Edit unit price"
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="p-2">
                      <Input readOnly value={rowTotal(row).toFixed(2)} className="bg-slate-100" />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsEditModalOpen(true)}
                          aria-label="Edit purchase"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(row.id)}
                          aria-label="Delete row"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
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

        <div className="sticky-form-actions flex flex-wrap items-center gap-2 mt-4">
          <Button
            type="button"
            onClick={() => setIsNewPurchaseModalOpen(true)}
            className="flex-1 justify-start border border-dashed border-emerald-500 text-emerald-500 hover:bg-green-50 bg-transparent"
            variant="ghost"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Purchase
          </Button>
          <Button type="button" variant="destructive" onClick={clearForm}>
            Delete
          </Button>
          <Button
            type="button"
            onClick={() => void savePurchase()}
            disabled={isSaving || tableRows.length === 0}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </Card>

      <Dialog open={isNewPurchaseModalOpen} onOpenChange={setIsNewPurchaseModalOpen}>
        <DialogContent className="max-w-[46.2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Add New Purchase</DialogTitle>
            <DialogDescription>Choose supplier, bill number, and date before adding products.</DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2" ref={newSupplierDropdownRef}>
                <Label htmlFor="new-purchase-supplier">Supplier</Label>
                <div className="relative">
                  <Input
                    id="new-purchase-supplier"
                    value={newSupplierQuery}
                    onChange={(event) => {
                      setNewSupplierQuery(event.target.value)
                      setNewSupplierId("")
                      setIsNewSupplierDropdownOpen(true)
                    }}
                    onFocus={() => setIsNewSupplierDropdownOpen(true)}
                    placeholder="Search supplier..."
                    className="h-10"
                    autoComplete="off"
                  />
                  {isNewSupplierDropdownOpen && (
                    <div className="dropdown-container">
                      <div className="dropdown-scroll dropdown-scroll-modal">
                        {filteredNewSuppliers.length > 0 ? (
                          filteredNewSuppliers.map((supplier) => (
                            <button
                              key={supplier.supplierId}
                              type="button"
                              onClick={() => handleSelectNewSupplier(supplier)}
                              className={`dropdown-item ${String(supplier.supplierId) === newSupplierId ? "selected" : ""}`}
                            >
                              {supplier.supplierName}
                            </button>
                          ))
                        ) : (
                          <div className="dropdown-empty-state">No suppliers found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-purchase-bill">Bill Number</Label>
                <Input
                  id="new-purchase-bill"
                  value={newBillNumber}
                  onChange={(event) => setNewBillNumber(event.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-purchase-date">Bill Date</Label>
                <DatePickerInput
                  id="new-purchase-date"
                  value={newPurchaseDate}
                  onChange={(value) => setNewPurchaseDate(value)}
                  className="h-10"
                  format="dd-mm-yy"
                />
              </div>
            </div>

            {(isHeaderPrepared || rows.length > 0) && (
              <>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-slate-100/80">
                      <tr>
                        <th className="text-left font-medium px-3 py-2" style={{ width: "50%" }}>Product</th>
                        <th className="text-left font-medium px-3 py-2" style={{ width: "25%" }}>Qty</th>
                        <th className="text-left font-medium px-3 py-2" style={{ width: "25%" }}>Unit Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                            No product rows. Use Add Product.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="p-2">
                              <select
                                value={row.productId ?? ""}
                                onChange={(event) =>
                                  updateProductForRow(row.id, event.target.value ? Number(event.target.value) : undefined)
                                }
                                className="h-9 w-full rounded border border-input bg-background px-2"
                              >
                                <option value="">Select product</option>
                                {products.map((product) => (
                                  <option key={product.productId} value={product.productId}>
                                    {product.productName}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                value={row.quantity}
                                onChange={(event) => updateRow(row.id, { quantity: Number(event.target.value || 0) })}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                value={row.unitPrice}
                                onChange={(event) => updateRow(row.id, { unitPrice: Number(event.target.value || 0) })}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="sticky-form-actions flex justify-center mt-2">
                  <Button
                    type="button"
                    onClick={addProductRow}
                    className="w-full justify-start border border-dashed border-emerald-500 text-emerald-500 hover:bg-green-50 bg-transparent"
                    variant="ghost"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </div>
              </>
            )}

            <DialogFooter className="sticky-form-actions flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsNewPurchaseModalOpen(false)
                  setIsHeaderPrepared(false)
                }}
              >
                Cancel
              </Button>
              {!isHeaderPrepared ? (
                <Button type="button" onClick={handleCreatePurchaseHeader}>
                  Save Header
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={async () => {
                    const ok = await savePurchase()
                    if (ok) {
                      setIsNewPurchaseModalOpen(false)
                      setIsHeaderPrepared(false)
                    }
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Purchase"}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Search Purchase Bill</DialogTitle>
            <DialogDescription>Find by bill number and load/edit the purchase.</DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3 overflow-y-auto max-h-[75vh]">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Enter bill number"
              />
              <Button type="button" onClick={() => void searchPurchases(searchQuery)} disabled={isSearching}>
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100/80">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Bill</th>
                    <th className="text-left font-medium px-3 py-2">Supplier</th>
                    <th className="text-left font-medium px-3 py-2">Date</th>
                    <th className="text-left font-medium px-3 py-2">Items</th>
                    <th className="text-left font-medium px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        No purchases found.
                      </td>
                    </tr>
                  ) : (
                    searchResults.map((result) => (
                      <tr key={result.purchaseId} className="border-t">
                        <td className="px-3 py-2">{result.refDocument || result.billNumber || "-"}</td>
                        <td className="px-3 py-2">{result.supplier || "-"}</td>
                        <td className="px-3 py-2">{result.purchaseDate ? formatDateDDMMYY(result.purchaseDate) : "-"}</td>
                        <td className="px-3 py-2">{Array.isArray(result.purchaseDetails) ? result.purchaseDetails.length : 0}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => void loadPurchaseToMain(result)}>
                              Load
                            </Button>
                            <Button type="button" onClick={() => void openEditForPurchase(result)}>
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-[79.2rem] max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Edit Purchase</DialogTitle>
            <DialogDescription>Update supplier, bill details, and products.</DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3 overflow-y-auto max-h-[75vh]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-purchase-supplier">Supplier</Label>
                <select
                  id="edit-purchase-supplier"
                  value={selectedSupplier?.supplierId || ""}
                  onChange={(event) => {
                    const supplier = suppliers.find((item) => item.supplierId === Number(event.target.value))
                    setSelectedSupplier(supplier || null)
                  }}
                  className="h-10 w-full rounded border border-input bg-background px-2"
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.supplierId} value={supplier.supplierId}>
                      {supplier.supplierName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-purchase-bill">Bill Number</Label>
                <Input
                  id="edit-purchase-bill"
                  value={billNumber}
                  onChange={(event) => setBillNumber(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-purchase-date">Bill Date</Label>
                <DatePickerInput
                  id="edit-purchase-date"
                  value={purchaseDate}
                  onChange={(value) => setPurchaseDate(value)}
                  format="dd-mm-yy"
                />
              </div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-slate-100/80">
                  <tr>
                    <th className="text-left font-medium px-3 py-2" style={{ width: "80%" }}>Product</th>
                    <th className="text-left font-medium px-3 py-2" style={{ width: "10%" }}>Qty</th>
                    <th className="text-left font-medium px-3 py-2" style={{ width: "10%" }}>Unit Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                        No products added.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-2">
                          <select
                            value={row.productId ?? ""}
                            onChange={(event) =>
                              updateProductForRow(row.id, event.target.value ? Number(event.target.value) : undefined)
                            }
                            className="h-9 w-full rounded border border-input bg-background px-2"
                          >
                            <option value="">Select product</option>
                            {products.map((product) => (
                              <option key={product.productId} value={product.productId}>
                                {product.productName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            value={row.quantity}
                            onChange={(event) => updateRow(row.id, { quantity: Number(event.target.value || 0) })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            value={row.unitPrice}
                            onChange={(event) => updateRow(row.id, { unitPrice: Number(event.target.value || 0) })}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <DialogFooter className="sticky-form-actions flex flex-col items-stretch gap-2">
              <Button
                type="button"
                onClick={addProductRow}
                variant="ghost"
                className="w-full justify-start border border-dashed border-emerald-500 text-emerald-500 hover:bg-green-50 bg-transparent"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const ok = await savePurchase()
                    if (ok) setIsEditModalOpen(false)
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPriceModalOpen} onOpenChange={setIsPriceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Unit Price</DialogTitle>
            <DialogDescription>{priceProduct?.productName || ""}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="price-update-input">New Price</Label>
            <Input
              id="price-update-input"
              type="number"
              min={0}
              value={priceValue}
              onChange={(event) => setPriceValue(event.target.value)}
            />
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsPriceModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitPriceChange()}>
              Save Price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

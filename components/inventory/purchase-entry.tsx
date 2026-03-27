'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateDDMMYY, parseDDMMYYToISO } from '@/lib/utils'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from '@/components/ui/notify'
import { cn } from '@/lib/utils'
import { notifySuppliersChanged } from '@/lib/suppliers'
import { getMobileValidationMessage, normalizeMobileNumber } from '@/lib/mobile-validation'
import DatePickerInput from '@/components/ui/date-picker-input'
// SupplierAutocomplete removed for inventory: show inline filtered list on typing

interface PurchaseLineItem {
  id: string
  productId: number
  product: string
  qnty: number
  purchasePrice: number
  sgstRate: number
  cgstRate: number
  amount: number
  sgstAmount: number
  cgstAmount: number
  totalAmount: number
}

interface Supplier {
  supplierId: number
  supplierName: string
  mobileNo: string
  address?: string
  gstin?: string
}

interface Product {
  productId: number
  productName: string
  hsnCode?: string
  unit?: string
  purchasePrice: number
  sgstRate: number
  cgstRate: number
  balanceStock: number
}

export function PurchaseEntryForm() {
  // supplier search removed; keep only supplierName manual input
  const [products, setProducts] = useState<Product[]>([])
  const [supplierName, setSupplierName] = useState<string>("")
  const [purchaseDate, setPurchaseDate] = useState(formatDateDDMMYY(new Date()))
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([])
  const [newRow, setNewRow] = useState<Partial<PurchaseLineItem>>({
    product: "",
    qnty: 1,
    purchasePrice: 0,
    sgstRate: 0,
    cgstRate: 0,
  })
  const [showSupplierDialog, setShowSupplierDialog] = useState(false)
  const [showProductDialog, setShowProductDialog] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)

  // Fetch suppliers
  // Fetch products (optionally by supplierId)
  

  // Fetch products (optional supplierId)
  const fetchProducts = async (supplierId?: number) => {
    try {
      const url = supplierId ? `/api/products?supplierId=${supplierId}` : `/api/products`
      const response = await fetch(url, { cache: 'force-cache' })
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive',
      })
    }
  }

  // supplier selection removed; user enters supplierName manually

  // Calculate line totals
  const calculateLineTotal = (
    qnty: number,
    purchasePrice: number,
    sgstRate: number,
    cgstRate: number
  ) => {
    const amount = qnty * purchasePrice
    const sgstAmount = (amount * sgstRate) / 100
    const cgstAmount = (amount * cgstRate) / 100
    const totalAmount = amount + sgstAmount + cgstAmount

    return { amount, sgstAmount, cgstAmount, totalAmount }
  }

  // Add line item
  const addLineItem = (product: Product) => {
    const newItem: PurchaseLineItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: product.productId,
      product: product.productName,
      qnty: 1,
      purchasePrice: product.purchasePrice,
      sgstRate: product.sgstRate,
      cgstRate: product.cgstRate,
      amount: product.purchasePrice,
      sgstAmount: (product.purchasePrice * product.sgstRate) / 100,
      cgstAmount: (product.purchasePrice * product.cgstRate) / 100,
      totalAmount:
        product.purchasePrice +
        (product.purchasePrice * product.sgstRate) / 100 +
        (product.purchasePrice * product.cgstRate) / 100,
    }
    setLineItems([...lineItems, newItem])
    setProductSearch('')
    setUnsavedChanges(true)
  }

  // Add a new empty row from table inputs
  const addNewRow = () => {
    if (!newRow || !newRow.product || (newRow.product || '').trim() === '') {
      toast({ title: 'Validation', description: 'Enter product name to add', variant: 'warning' })
      return
    }

    const newItem: PurchaseLineItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: (newRow.productId as number) || 0,
      product: (newRow.product as string) || '',
      qnty: (newRow.qnty as number) || 1,
      purchasePrice: (newRow.purchasePrice as number) || 0,
      sgstRate: (newRow.sgstRate as number) || 0,
      cgstRate: (newRow.cgstRate as number) || 0,
      amount: 0,
      sgstAmount: 0,
      cgstAmount: 0,
      totalAmount: 0,
    }

    const { amount, sgstAmount, cgstAmount, totalAmount } = calculateLineTotal(
      newItem.qnty,
      newItem.purchasePrice,
      newItem.sgstRate,
      newItem.cgstRate
    )

    newItem.amount = amount
    newItem.sgstAmount = sgstAmount
    newItem.cgstAmount = cgstAmount
    newItem.totalAmount = totalAmount

    setLineItems([...lineItems, newItem])
    setNewRow({ product: '', qnty: 1, purchasePrice: 0, sgstRate: 0, cgstRate: 0 })
    setUnsavedChanges(true)
  }

  // Update line item
  const updateLineItem = (id: string, updates: Partial<PurchaseLineItem>) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, ...updates }
          const { amount, sgstAmount, cgstAmount, totalAmount } = calculateLineTotal(
            updatedItem.qnty,
            updatedItem.purchasePrice,
            updatedItem.sgstRate,
            updatedItem.cgstRate
          )
          return {
            ...updatedItem,
            amount,
            sgstAmount,
            cgstAmount,
            totalAmount,
          }
        }
        return item
      })
    )
    setUnsavedChanges(true)
  }

  // Remove line item
  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id))
    setUnsavedChanges(true)
  }

  // Calculate totals
  const totals = lineItems.reduce(
    (acc, item) => ({
      amount: acc.amount + item.amount,
      sgst: acc.sgst + item.sgstAmount,
      cgst: acc.cgst + item.cgstAmount,
      total: acc.total + item.totalAmount,
    }),
    { amount: 0, sgst: 0, cgst: 0, total: 0 }
  )

  // Save purchase
  const handleSave = async () => {
    if (!supplierName.trim() || lineItems.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter supplier name and add at least one product',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const isoDate = parseDDMMYYToISO(purchaseDate)
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier: supplierName.trim(),
          purchaseDate: isoDate,
          address: null,
          mobileNo: null,
          gstin: null,
          details: lineItems.map((item) => ({
            productId: item.productId,
            product: item.product,
            qnty: item.qnty,
            purchasePrice: item.purchasePrice,
            sgstRate: item.sgstRate,
            cgstRate: item.cgstRate,
            amount: item.amount,
            sgstAmount: item.sgstAmount,
            cgstAmount: item.cgstAmount,
            totalAmount: item.totalAmount,
          })),
        }),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Purchase saved successfully',
        })
        // Reset form
        setSupplierName("")
        setLineItems([])
        setUnsavedChanges(false)
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save purchase')
      }
    } catch (error) {
      console.error('Error saving purchase:', error)
      const message = error instanceof Error ? error.message : 'Failed to save purchase'
      const isDuplicate = String(message).toLowerCase().includes('duplicate purchase')
      toast({
        title: isDuplicate ? 'Duplicate Entry' : 'Error',
        description: message,
        variant: isDuplicate ? 'warning' : 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [unsavedChanges])

  return (
    <div className="w-full space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Purchase Entry (Inward Stock)</CardTitle>
          <CardDescription>Add a new purchase transaction with supplier details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Form - Sticky */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 -mx-6 px-6 pt-2 border-b">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Supplier Selection (manual) */}
              <div className="space-y-2">
                <Label>Supplier</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Supplier name"
                      value={supplierName}
                      onChange={(e) => {
                        setSupplierName(e.target.value)
                        setUnsavedChanges(true)
                      }}
                      className="h-8"
                    />
                  </div>
                  <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        + Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Supplier</DialogTitle>
                      </DialogHeader>
                      <AddSupplierForm onSuccess={() => setShowSupplierDialog(false)} />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Purchase Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Purchase Date</Label>
                <DatePickerInput
                  id="date"
                  value={purchaseDate}
                  onChange={(e) => {
                    setPurchaseDate(e)
                    setUnsavedChanges(true)
                  }}
                  format="dd-mm-yy"
                />
              </div>

              {/* Supplier Info (Read-only) */}
              {supplierName && (
                <div className="space-y-2">
                  <Label>Supplier Details</Label>
                  <div className="rounded-md border bg-gray-50 p-3 text-sm">
                    <div>{supplierName}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Grid */}
          {(
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Purchase Items</h3>
              </div>

              {/* Add Product */}
              <div className="flex gap-2">
                <Input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                  }}
                  onFocus={() => fetchProducts()}
                  className="flex-1 h-8"
                />
                {productSearch && products.length > 0 && (
                  <div className="absolute z-50 mt-10 max-h-48 w-80 dropdown-scroll">
                    {products.map((product) => (
                      <button
                        key={product.productId}
                        type="button"
                        className="dropdown-item"
                        onClick={() => addLineItem(product)}
                      >
                        <div className="font-medium">{product.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          HSN: {product.hsnCode} | Stock: {product.balanceStock}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Line Items Table - always render and include an empty input row */}
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader className="bg-gray-100">
                    <TableRow>
                      <TableHead className="w-32">Product</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-24">Purchase Price</TableHead>
                      <TableHead className="w-16">SGST %</TableHead>
                      <TableHead className="w-16">CGST %</TableHead>
                      <TableHead className="w-24">Amount</TableHead>
                      <TableHead className="w-24">SGST Amt</TableHead>
                      <TableHead className="w-24">CGST Amt</TableHead>
                      <TableHead className="w-24">Total</TableHead>
                      <TableHead className="w-16">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.qnty}
                            onChange={(e) =>
                              updateLineItem(item.id, { qnty: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.purchasePrice}
                            onChange={(e) =>
                              updateLineItem(item.id, {
                                purchasePrice: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-24 h-8"
                          />
                        </TableCell>
                        <TableCell>{item.sgstRate}%</TableCell>
                        <TableCell>{item.cgstRate}%</TableCell>
                        <TableCell>{item.amount.toFixed(2)}</TableCell>
                        <TableCell>{item.sgstAmount.toFixed(2)}</TableCell>
                        <TableCell>{item.cgstAmount.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">{item.totalAmount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id)}
                            className="text-red-600 hover:text-red-800 h-8"
                          >
                            ✕
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Always-visible empty row for adding new items */}
                    <TableRow>
                      <TableCell>
                        <Input
                          placeholder="Product name"
                          value={newRow.product || ''}
                          onChange={(e) => setNewRow({ ...newRow, product: e.target.value })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={newRow.qnty as number}
                          onChange={(e) => setNewRow({ ...newRow, qnty: parseFloat(e.target.value) || 1 })}
                          className="w-20 h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={newRow.purchasePrice as number}
                          onChange={(e) => setNewRow({ ...newRow, purchasePrice: parseFloat(e.target.value) || 0 })}
                          className="w-24 h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={newRow.sgstRate as number}
                          onChange={(e) => setNewRow({ ...newRow, sgstRate: parseFloat(e.target.value) || 0 })}
                          className="w-16 h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={newRow.cgstRate as number}
                          onChange={(e) => setNewRow({ ...newRow, cgstRate: parseFloat(e.target.value) || 0 })}
                          className="w-16 h-8"
                        />
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={addNewRow} className="h-8">
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Totals Summary */}
              {lineItems.length > 0 && (
                <div className="ml-auto w-80 space-y-2 rounded-md border bg-gray-50 p-4">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold">₹{totals.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span>₹{totals.sgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span>₹{totals.cgst.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">Grand Total:</span>
                      <span className="text-lg font-bold">₹{totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="sticky-form-actions flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => {
                if (unsavedChanges) {
                  if (confirm('Discard unsaved changes?')) {
                      setSupplierName("")
                    setLineItems([])
                    setUnsavedChanges(false)
                  }
                }
              }}
              className="px-4 py-2 min-h-[40px]"
            >
              Clear
            </Button>
            <Button onClick={handleSave} disabled={isLoading || !supplierName.trim() || lineItems.length === 0} className="px-4 py-2 min-h-[40px]">
              {isLoading ? 'Saving...' : 'Save Purchase'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Add Supplier Modal Component
function AddSupplierForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    supplierName: '',
    mobileNo: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    district: '',
    postalCode: '',
    gstin: '',
    pan: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const mobileError = getMobileValidationMessage(formData.mobileNo, 'Supplier mobile number')
    if (mobileError) {
      toast({
        title: 'Validation Error',
        description: mobileError,
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          address: [
            formData.addressLine1,
            formData.addressLine2,
            formData.city,
            formData.district,
            formData.postalCode,
          ].map((item) => item.trim()).filter(Boolean).join(', '),
          mobileNo: normalizeMobileNumber(formData.mobileNo),
        }),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Supplier added successfully',
        })
        try {
          notifySuppliersChanged()
        } catch {}
        onSuccess()
      } else {
        throw new Error('Failed to add supplier')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add supplier',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="supplierName">Supplier Name*</Label>
        <Input
          id="supplierName"
          required
          value={formData.supplierName}
          onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
          className="h-8"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mobileNo">Mobile No*</Label>
        <Input
          id="mobileNo"
          required
          value={formData.mobileNo}
          onChange={(e) => setFormData({ ...formData, mobileNo: normalizeMobileNumber(e.target.value) })}
          inputMode="numeric"
          maxLength={10}
          pattern="[0-9]{10}"
          className="h-8"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address Line 1 (Apartment, Suite, Unit, Building, Floor)</Label>
        <Input
          id="addressLine1"
          value={formData.addressLine1}
          onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
          className="h-8"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address Line 2 (Street Address)</Label>
        <Input
          id="addressLine2"
          value={formData.addressLine2}
          onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
          className="h-8"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="h-8"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="district">District</Label>
          <Input
            id="district"
            value={formData.district}
            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
            className="h-8"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            className="h-8"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="gstin">GSTIN</Label>
        <Input
          id="gstin"
          value={formData.gstin}
          onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
          className="h-8"
        />
      </div>
      <Button type="submit" className="w-full h-8" disabled={isLoading}>
        {isLoading ? 'Adding...' : 'Add Supplier'}
      </Button>
    </form>
  )
}

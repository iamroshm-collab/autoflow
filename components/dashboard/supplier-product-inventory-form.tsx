"use client"

import React, { useEffect, useMemo, useState, useRef } from "react"
import { toNumber } from '@/lib/utils'
import { getMobileValidationMessage, normalizeMobileNumber } from '@/lib/mobile-validation'
import { Trash2, Plus, Pencil } from "lucide-react"
// Reverted last edit: using original `Pencil` from lucide-react
import { notify } from '@/components/ui/notify'
import { startAction, successAction, errorAction } from "@/lib/action-feedback"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import SupplierAutocomplete from '@/components/SupplierAutocomplete'
import { Label } from "@/components/ui/label"
import StateSelect from "@/components/ui/state-select"
import { Textarea } from "@/components/ui/textarea"
import { composeAddress, parseAddress } from "@/lib/address-utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import useContinuousRows from '@/components/hooks/useContinuousRows'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface StateOption {
  stateId: string
  stateName: string
  stateCode: string | null
}

const toDateTimeLocalInput = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

const toDateTimeLocalFromString = (value?: string | null) => {
  if (!value) return toDateTimeLocalInput()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return toDateTimeLocalInput()
  return toDateTimeLocalInput(parsed)
}

const computeSalePriceFromMRP = (
  mrpValue: string | number,
  sgstValue: string | number = 0,
  cgstValue: string | number = 0,
  igstValue: string | number = 0
) => {
  const mrp = toNumber(mrpValue)
  const sgst = toNumber(sgstValue)
  const cgst = toNumber(cgstValue)
  const igst = toNumber(igstValue)
  const taxPercent = sgst + cgst + igst

  if (mrp <= 0 || taxPercent <= 0) return String(mrp)

  // Calculate base sale price: salePrice = MRP / (1 + taxPercent / 100)
  const base = mrp / (1 + taxPercent / 100)
  
  // Round down to ensure salePrice + taxes <= MRP
  let salePrice = Math.floor(base)
  
  // Verify constraint: salePrice * (1 + taxPercent / 100) <= MRP
  // If not met, reduce salePrice further
  while (salePrice * (1 + taxPercent / 100) > mrp && salePrice > 0) {
    salePrice--
  }
  
  return String(salePrice)
}


interface SupplierListItem {
  supplierId: number
  supplierName: string
  mobileNo: string
  stateCode: string | null
  stateName: string | null
  createdOn: string
  _count: {
    products: number
  }
}

interface SupplierFormState {
  supplierId: string
  supplierName: string
  address: string
  addressLine1: string
  addressLine2: string
  city: string
  district: string
  postalCode: string
  mobileNo: string
  stateName: string
  stateCode: string
  gstin: string
  pan: string
  createdOn: string
}

interface ProductRow {
  rowId: string
  id: string
  productName: string
  unit: string
  hsnCode: string
  mrp: string
  cgstRate: string
  purchasePrice: string
  salePrice: string
  sgstRate: string
  igstRate: string
  createdOn: string
}

const createEmptyProductRow = (): ProductRow => {
  const uniqueId = `${Date.now()}-${Math.random()}`
  return {
    rowId: uniqueId,
    id: uniqueId,
    productName: "",
    unit: "",
    hsnCode: "",
    mrp: "0",
    cgstRate: "0",
    purchasePrice: "0",
    salePrice: "0",
    sgstRate: "0",
    igstRate: "0",
    createdOn: toDateTimeLocalInput(),
  }
}

const isProductRowTouched = (row: ProductRow) =>
  Boolean(
    row.productName.trim() ||
      row.unit.trim() ||
      row.hsnCode.trim() ||
      toNumber(row.mrp) > 0 ||
      toNumber(row.cgstRate) > 0 ||
      toNumber(row.purchasePrice) > 0 ||
      toNumber(row.salePrice) > 0 ||
      toNumber(row.sgstRate) > 0 ||
      toNumber(row.igstRate) > 0
  )

const defaultSupplierForm = (): SupplierFormState => ({
  supplierId: "",
  supplierName: "",
  address: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  postalCode: "",
  mobileNo: "",
  stateName: "",
  stateCode: "",
  gstin: "",
  pan: "",
  createdOn: toDateTimeLocalInput(),
})

interface SupplierProductInventoryFormProps {
  activeTab?: "suppliers" | "products"
  supplierSelectRef?: React.MutableRefObject<((supplier: { supplierId: number }) => void) | null>
  searchTerm?: string
  onRecordsCountChange?: (count: number) => void
  onSelectedSupplierSummaryChange?: (summary: { name: string; mobile: string } | null) => void
}

export function SupplierProductInventoryForm({
  activeTab = "suppliers",
  supplierSelectRef,
  searchTerm = "",
  onRecordsCountChange,
  onSelectedSupplierSummaryChange,
}: SupplierProductInventoryFormProps = {}) {
  const unitOptions = [
    "",
    "Nos",
    "Set",
    "Piece",
    "Pair",
    "Litre",
    "Kg",
    "Gram",
    "Meter",
    "Box",
    "Pack",
  ]
  // state list is provided by components/ui/state-select
  const [search, setSearch] = useState("")
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null)

  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(defaultSupplierForm)
  const { rows: products, updateRow: updateProductRow, addRow: addProductRow, removeRow: removeProductRowHook, setRows: setProducts } = useContinuousRows<ProductRow>(() => createEmptyProductRow(), [], { autoAppend: false })

  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [addSupplierDialogOpen, setAddSupplierDialogOpen] = useState(false)
  const [newSupplierForm, setNewSupplierForm] = useState<SupplierFormState>(defaultSupplierForm)
  const [editingFromListId, setEditingFromListId] = useState<number | null>(null)
  const [availableStates, setAvailableStates] = useState<StateOption[]>([])
  const [isLoadingStates, setIsLoadingStates] = useState(false)
  const [newSupplierStateFilter, setNewSupplierStateFilter] = useState("")
  const [showNewSupplierStateDropdown, setShowNewSupplierStateDropdown] = useState(false)
  const [newSupplierStateSelectedIndex, setNewSupplierStateSelectedIndex] = useState(-1)
  const newSupplierStateOptionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const newSupplierStateListRef = useRef<HTMLDivElement | null>(null)
  
  // Edit supplier modal state
  const [editSupplierModalOpen, setEditSupplierModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierListItem | null>(null)
  const [editSupplierForm, setEditSupplierForm] = useState<SupplierFormState>(defaultSupplierForm)
  const [editSupplierProducts, setEditSupplierProducts] = useState<ProductRow[]>([])
  
  // Edit product modal state
  const [editProductModalOpen, setEditProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [editProductForm, setEditProductForm] = useState<ProductRow>(createEmptyProductRow)
  
  // Shop settings state
  const [shopStateId, setShopStateId] = useState<string>("")
  const [shopStateName, setShopStateName] = useState<string>("")
  const [shopGstin, setShopGstin] = useState<string>("")

  const totalPurchaseValue = useMemo(
    () =>
      products.reduce(
        (sum, row) => sum + toNumber(row.purchasePrice),
        0
      ),
    [products]
  )

  const resolveStateCode = (stateKey?: string, stateCode?: string, gstin?: string) => {
    const direct = String(stateCode || "").trim()
    if (direct) return direct

    const gstinCode = String(gstin || "").trim().slice(0, 2)
    if (/^\d{2}$/.test(gstinCode)) return gstinCode

    const key = String(stateKey || "").trim()
    const matched = availableStates.find(
      (state) => state.stateId === key || String(state.stateCode || "").trim() === key
    )
    return String(matched?.stateCode || "").trim()
  }

  const resolveStateName = (stateKey?: string, stateName?: string) => {
    const direct = String(stateName || "").trim()
    if (direct) return direct.toLowerCase()

    const key = String(stateKey || "").trim()
    const matched = availableStates.find(
      (state) => state.stateId === key || String(state.stateCode || "").trim() === key
    )
    return String(matched?.stateName || "").trim().toLowerCase()
  }

  const areSupplierAndShopSameState = (
    supplierStateCode?: string,
    supplierStateName?: string,
    supplierGstin?: string
  ) => {
    const supplierCode = resolveStateCode(supplierStateCode, supplierStateCode, supplierGstin)
    const shopCode = resolveStateCode(shopStateId, "", shopGstin)

    if (supplierCode && shopCode) {
      return supplierCode === shopCode
    }

    const supplierCodeFromInput = String(supplierStateCode || "").trim()
    const shopCodeFromInput = String(shopStateId || "").trim()
    if (supplierCodeFromInput && shopCodeFromInput) {
      return supplierCodeFromInput === shopCodeFromInput
    }

    const supplierName = resolveStateName(supplierStateCode, supplierStateName)
    const shopName = resolveStateName(shopStateId, shopStateName)
    if (supplierName && shopName) {
      return supplierName === shopName
    }

    return false
  }

  // Helper function to check if supplier state matches shop state
  const isSameStateAsShop = areSupplierAndShopSameState(
    supplierForm.stateCode,
    supplierForm.stateName,
    supplierForm.gstin
  )

  const loadSuppliers = async () => {
    // fetch suppliers (API supports empty search to return recent/all)
    setIsLoadingList(true)
    try {
      const response = await fetch(`/api/suppliers?search=`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load suppliers")
      }

      const list = Array.isArray(data) ? data : []
      const sorted = [...list].sort((a, b) => (a?.supplierName || '').localeCompare(b?.supplierName || '', undefined, { sensitivity: 'base' }))
      setSuppliers(sorted)
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to load suppliers")
      setSuppliers([])
    } finally {
      setIsLoadingList(false)
    }
  }
  useEffect(() => {
    loadSuppliers()
    // Fetch available states
    const fetchStates = async () => {
      setIsLoadingStates(true)
      try {
        const response = await fetch("/api/states")
        const data = await response.json()
        if (Array.isArray(data)) {
          setAvailableStates(data)
        }
      } catch (error) {
        console.error("Failed to fetch states:", error)
      } finally {
        setIsLoadingStates(false)
      }
    }
    // Fetch shop settings to get shop state code
    const fetchShopSettings = async () => {
      try {
        const response = await fetch("/api/settings/shop")
        const data = await response.json()
        if (data.stateId) {
          setShopStateId(data.stateId)
        }
        setShopStateName(String(data.state || ""))
        setShopGstin(String(data.gstin || ""))
      } catch (error) {
        console.error("Failed to fetch shop settings:", error)
      }
    }
    fetchStates()
    fetchShopSettings()
  }, [])

  // Default new supplier state to shop state when the Add dialog opens fresh
  useEffect(() => {
    if (!addSupplierDialogOpen || editingFromListId !== null) return
    if (!shopStateId || availableStates.length === 0) return
    const shopState = availableStates.find(
      (s) => s.stateCode === shopStateId || s.stateId === shopStateId
    )
    if (shopState) {
      const code = String(shopState.stateCode || "")
      const name = shopState.stateName
      setNewSupplierForm((prev) => ({
        ...prev,
        stateName: name,
        stateCode: code,
      }))
      setNewSupplierStateFilter(`${code} - ${name}`)
    }
  }, [addSupplierDialogOpen, editingFromListId, shopStateId, availableStates])

  const normalizedSearch = useMemo(() => String(searchTerm || "").trim().toLowerCase(), [searchTerm])

  const visibleSuppliers = useMemo(() => {
    if (!normalizedSearch) return suppliers
    return suppliers.filter((supplier) => {
      const name = String(supplier.supplierName || "").toLowerCase()
      const mobile = String(supplier.mobileNo || "").toLowerCase()
      const state = String(supplier.stateName || "").toLowerCase()
      return name.includes(normalizedSearch) || mobile.includes(normalizedSearch) || state.includes(normalizedSearch)
    })
  }, [normalizedSearch, suppliers])

  const visibleProducts = useMemo(() => {
    if (!normalizedSearch) return products
    return products.filter((row) => {
      const productName = String(row.productName || "").toLowerCase()
      const unit = String(row.unit || "").toLowerCase()
      const hsn = String(row.hsnCode || "").toLowerCase()
      return productName.includes(normalizedSearch) || unit.includes(normalizedSearch) || hsn.includes(normalizedSearch)
    })
  }, [normalizedSearch, products])

  useEffect(() => {
    const count = activeTab === "suppliers" ? visibleSuppliers.length : visibleProducts.length
    onRecordsCountChange?.(count)
  }, [activeTab, visibleSuppliers.length, visibleProducts.length, onRecordsCountChange])

  useEffect(() => {
    if (activeTab !== "products" || !selectedSupplierId || !supplierForm.supplierName.trim()) {
      onSelectedSupplierSummaryChange?.(null)
      return
    }

    onSelectedSupplierSummaryChange?.({
      name: supplierForm.supplierName.trim(),
      mobile: supplierForm.mobileNo.trim(),
    })
  }, [activeTab, onSelectedSupplierSummaryChange, selectedSupplierId, supplierForm.mobileNo, supplierForm.supplierName])

  const loadSupplierDetails = async (supplierId: number) => {
    setIsLoadingDetails(true)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load supplier details")
      }

      setSelectedSupplierId(data.supplierId)
      const parsedAddress = parseAddress(data.address)
      setSupplierForm({
        supplierId: String(data.supplierId) || "",
        supplierName: data.supplierName || "",
        address: data.address || "",
        addressLine1: parsedAddress.line1,
        addressLine2: parsedAddress.line2,
        city: parsedAddress.city,
        district: parsedAddress.district,
        postalCode: parsedAddress.postalCode,
        mobileNo: data.mobileNo || "",
        stateName: data.stateName || "",
        stateCode: data.stateCode || data.stateId || "",
        gstin: data.gstin || "",
        pan: data.pan || "",
        createdOn: toDateTimeLocalFromString(data.createdOn),
      })

      const productRows: ProductRow[] = Array.isArray(data.products)
        ? data.products.map((item: any) => ({
            rowId: `${item.productId}`,
            id: `${item.productId}`,
            productName: item.productName || "",
            unit: item.unit || "",
            hsnCode: item.hsnCode || "",
            mrp: String(item.mrp || 0),
            cgstRate: String(item.cgstRate || 0),
            purchasePrice: String(item.purchasePrice || 0),
            // compute salePrice from MRP/taxes when no explicit salePrice is present
            salePrice: String(
              item.salePrice && toNumber(item.salePrice) > 0
                ? String(item.salePrice)
                : computeSalePriceFromMRP(item.mrp, item.sgstRate, item.cgstRate, item.igstRate)
            ),
            sgstRate: String(item.sgstRate || 0),
            igstRate: String(item.igstRate || 0),
            createdOn: toDateTimeLocalFromString(item.createdOn),
          }))
        : []

      const populatedRows = productRows.length > 0 ? productRows : []
      setProducts(populatedRows)
      // Keep suppliers list available for future searches, only clear the search term
      setSearch("")
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to load supplier details")
    } finally {
      setIsLoadingDetails(false)
    }
  }

  // Expose loadSupplierDetails to the top bar via ref
  useEffect(() => {
    if (supplierSelectRef) {
      supplierSelectRef.current = (s) => loadSupplierDetails(s.supplierId)
    }
  })

  const handleClearNew = () => {
    setSelectedSupplierId(null)
    setSupplierForm(defaultSupplierForm())
    setProducts([createEmptyProductRow()])
  }

  const handleProductFieldChange = (rowId: string, field: keyof ProductRow, value: string) => {
    // compute patch based on field and call updateRow from the hook
    if (field === "mrp") {
      const newMRP = value
      // need current row to compute salePrice
      const current = products.find(r => r.rowId === rowId)
      const sgst = current?.sgstRate || "0"
      const cgst = current?.cgstRate || "0"
      const igst = current?.igstRate || "0"
      const newSale = computeSalePriceFromMRP(newMRP, sgst, cgst, igst)
      updateProductRow(rowId, { mrp: newMRP, salePrice: newSale })
      return
    }

    if (field === "igstRate") {
      const newIgst = value
      const igstNum = toNumber(newIgst)
      const half = (igstNum / 2).toFixed(2)
      const newSgst = half
      const newCgst = half
      const current = products.find(r => r.rowId === rowId)
      const newSale = computeSalePriceFromMRP(current?.mrp || "0", newSgst, newCgst, newIgst)
      updateProductRow(rowId, { igstRate: String(newIgst), sgstRate: String(newSgst), cgstRate: String(newCgst), salePrice: newSale })
      return
    }

    if (field === "sgstRate") {
      const newSgst = value
      const current = products.find(r => r.rowId === rowId)
      const newSale = computeSalePriceFromMRP(current?.mrp || "0", newSgst, current?.cgstRate || "0", "0")
      updateProductRow(rowId, { sgstRate: String(newSgst), igstRate: "0", salePrice: newSale })
      return
    }

    if (field === "cgstRate") {
      const newCgst = value
      const current = products.find(r => r.rowId === rowId)
      const newSale = computeSalePriceFromMRP(current?.mrp || "0", current?.sgstRate || "0", newCgst, "0")
      updateProductRow(rowId, { cgstRate: String(newCgst), igstRate: "0", salePrice: newSale })
      return
    }

    // capitalize first letter for product name
    if (field === "productName") {
      const capitalizedValue = value.charAt(0).toUpperCase() + value.slice(1)
      updateProductRow(rowId, { [field]: capitalizedValue } as Partial<ProductRow>)
      return
    }

    // default field update
    updateProductRow(rowId, { [field]: value } as Partial<ProductRow>)
  }

  const handleProductRowFocus = (rowId: string) => {
    return
  }

  const removeProductRowLocal = (rowId: string) => {
    // use hook's removeRow implementation
    removeProductRowHook(rowId)
    // ensure at least one empty row
    setProducts((prev) => (prev.length > 0 ? prev : [createEmptyProductRow()]))
  }

  const validateProductRow = (row: ProductRow, index: number): { error: string | null; rowId: string; field: string } | null => {
    // Check if product row is touched (has data)
    if (!isProductRowTouched(row)) {
      return null // Skip validation for empty rows
    }

    const productIdentifier = row.productName.trim() || `Product Row ${index + 1}`

    // Validate all required fields
    if (!row.productName.trim()) {
      return { error: `${productIdentifier}: Product Name is required`, rowId: row.rowId, field: "productName" }
    }
    if (!row.unit.trim()) {
      return { error: `${productIdentifier}: Unit is required`, rowId: row.rowId, field: "unit" }
    }
    if (!row.hsnCode.trim()) {
      return { error: `${productIdentifier}: HSN Code is required`, rowId: row.rowId, field: "hsnCode" }
    }
    if (toNumber(row.mrp) <= 0) {
      return { error: `${productIdentifier}: MRP must be greater than 0`, rowId: row.rowId, field: "mrp" }
    }
    if (toNumber(row.purchasePrice) <= 0) {
      return { error: `${productIdentifier}: Purchase Price must be greater than 0`, rowId: row.rowId, field: "purchasePrice" }
    }
    if (isSameStateAsShop) {
      if (toNumber(row.sgstRate) <= 0) {
        return { error: `${productIdentifier}: SGST % is required`, rowId: row.rowId, field: "sgstRate" }
      }
    } else {
      if (toNumber(row.igstRate) <= 0) {
        return { error: `${productIdentifier}: IGST % is required`, rowId: row.rowId, field: "igstRate" }
      }
    }

    return null // All validations passed
  }

  const handleSave = async () => {
    if (!supplierForm.supplierName.trim() || !supplierForm.mobileNo.trim()) {
      errorAction("SupplierName and MobileNo are required")
      return
    }

    const supplierMobileError = getMobileValidationMessage(supplierForm.mobileNo, "Supplier mobile number")
    if (supplierMobileError) {
      errorAction(supplierMobileError)
      return
    }

    const isProductTab = activeTab === "products"

    // Validate product fields only for Products tab save.
    if (isProductTab) {
      for (let i = 0; i < products.length; i++) {
        const validationResult = validateProductRow(products[i], i)
        if (validationResult) {
          errorAction(validationResult.error || "Validation failed")
          // Set focus to the failing field.
          setTimeout(() => {
            const input = document.querySelector(`[data-product-id="${validationResult.rowId}"][data-field="${validationResult.field}"]`) as HTMLInputElement | HTMLSelectElement
            if (input) {
              input.focus()
              input.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          }, 100)
          return
        }
      }
    }

    setIsSaving(true)
    try {
      const touchedProducts = products.filter(isProductRowTouched).map((row) => {
        const sameState = areSupplierAndShopSameState(
          supplierForm.stateCode,
          supplierForm.stateName,
          supplierForm.gstin
        )
        const sgstRate = sameState ? toNumber(row.sgstRate) : 0
        const cgstRate = sameState ? toNumber(row.cgstRate || row.sgstRate) : 0
        const igstRate = sameState ? 0 : toNumber(row.igstRate || (toNumber(row.sgstRate) + toNumber(row.cgstRate)))

        return {
          productId: /^\d+$/.test(String(row.id)) ? Number(row.id) : undefined,
          productName: row.productName.trim(),
          unit: row.unit.trim(),
          hsnCode: row.hsnCode.trim(),
          mrp: toNumber(row.mrp),
          cgstRate,
          purchasePrice: toNumber(row.purchasePrice),
          salePrice: toNumber(row.salePrice),
          sgstRate,
          igstRate,
          createdOn: row.createdOn,
        }
      })

      const payload = {
        supplierName: String(supplierForm.supplierName || "").trim(),
        address: composeAddress(
          {
            line1: supplierForm.addressLine1,
            line2: supplierForm.addressLine2,
            city: supplierForm.city,
            district: supplierForm.district,
            postalCode: supplierForm.postalCode,
          },
          { includeState: false }
        ),
        mobileNo: normalizeMobileNumber(supplierForm.mobileNo),
        stateCode: String(supplierForm.stateCode || "").trim(),
        stateName: String(supplierForm.stateName || "").trim(),
        gstin: String(supplierForm.gstin || "").trim(),
        pan: String(supplierForm.pan || "").trim(),
        createdOn: supplierForm.createdOn || toDateTimeLocalInput(),
        ...(isProductTab ? { products: touchedProducts } : {}),
      }

      const method = selectedSupplierId ? "PUT" : "POST"
      const url = selectedSupplierId ? `/api/suppliers/${selectedSupplierId}` : "/api/suppliers"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        console.error("[SUPPLIER_SAVE_ERROR] Status:", response.status)
        console.error("[SUPPLIER_SAVE_ERROR] Response:", JSON.stringify(data))
        console.error("[SUPPLIER_SAVE_ERROR] Payload sent:", JSON.stringify(payload))
        throw new Error(
          data.details
            ? `${data.error || "Failed to save supplier"}: ${data.details}`
            : (data.error || "Failed to save supplier")
        )
      }

      successAction(isProductTab ? "Products updated" : (selectedSupplierId ? "Supplier updated" : "Supplier created"))
      await loadSuppliers()

      if (data?.supplierId) {
        await loadSupplierDetails(data.supplierId)
      }
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to save supplier")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSupplier = async () => {
    if (!selectedSupplierId) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/suppliers/${selectedSupplierId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete supplier")
      }

      successAction("Supplier deleted")
      setDeleteDialogOpen(false)
      handleClearNew()
      await loadSuppliers()
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to delete supplier")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditSupplier = async (supplier: SupplierListItem) => {
    setIsLoadingDetails(true)
    try {
      const response = await fetch(`/api/suppliers/${supplier.supplierId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load supplier details")
      }

      const parsedAddress = parseAddress(data.address)
      setNewSupplierForm({
        supplierId: String(data.supplierId) || "",
        supplierName: data.supplierName || "",
        address: data.address || "",
        addressLine1: parsedAddress.line1,
        addressLine2: parsedAddress.line2,
        city: parsedAddress.city,
        district: parsedAddress.district,
        postalCode: parsedAddress.postalCode,
        mobileNo: data.mobileNo || "",
        stateName: data.stateName || "",
        stateCode: data.stateCode || data.stateId || "",
        gstin: data.gstin || "",
        pan: data.pan || "",
        createdOn: toDateTimeLocalFromString(data.createdOn),
      })
      
      // Populate state filter with code and name
      const supplierStateKey = String(data.stateCode || data.stateId || "")
      const selectedState = availableStates.find(
        (s) => s.stateId === supplierStateKey || String(s.stateCode || "") === supplierStateKey
      )
      const stateDisplay = selectedState 
        ? `${selectedState.stateCode} - ${selectedState.stateName}`
        : (data.stateName || "")
      setNewSupplierStateFilter(stateDisplay)
      setEditingFromListId(supplier.supplierId)
      setAddSupplierDialogOpen(true)
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to load supplier details")
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleSaveEditSupplier = async () => {
    if (!editingSupplier) return
    if (!editSupplierForm.supplierName.trim() || !editSupplierForm.mobileNo.trim()) {
      errorAction("SupplierName and MobileNo are required")
      return
    }

    const editSupplierMobileError = getMobileValidationMessage(editSupplierForm.mobileNo, "Supplier mobile number")
    if (editSupplierMobileError) {
      errorAction(editSupplierMobileError)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        supplierName: String(editSupplierForm.supplierName || "").trim(),
        address: composeAddress(
          {
            line1: editSupplierForm.addressLine1,
            line2: editSupplierForm.addressLine2,
            city: editSupplierForm.city,
            district: editSupplierForm.district,
            postalCode: editSupplierForm.postalCode,
          },
          { includeState: false }
        ),
        mobileNo: normalizeMobileNumber(editSupplierForm.mobileNo),
        stateCode: String(editSupplierForm.stateCode || "").trim(),
        stateName: String(editSupplierForm.stateName || "").trim(),
        gstin: String(editSupplierForm.gstin || "").trim(),
        pan: String(editSupplierForm.pan || "").trim(),
        createdOn: editSupplierForm.createdOn || toDateTimeLocalInput(),
        products: editSupplierProducts.filter(isProductRowTouched).map((row) => {
          const sameState = areSupplierAndShopSameState(
            editSupplierForm.stateCode,
            editSupplierForm.stateName,
            editSupplierForm.gstin
          )
          const sgstRate = sameState ? toNumber(row.sgstRate) : 0
          const cgstRate = sameState ? toNumber(row.cgstRate || row.sgstRate) : 0
          const igstRate = sameState ? 0 : toNumber(row.igstRate || (toNumber(row.sgstRate) + toNumber(row.cgstRate)))

          return {
            productName: row.productName.trim(),
            unit: row.unit.trim(),
            hsnCode: row.hsnCode.trim(),
            mrp: toNumber(row.mrp),
            cgstRate,
            purchasePrice: toNumber(row.purchasePrice),
            salePrice: toNumber(row.salePrice),
            sgstRate,
            igstRate,
            createdOn: row.createdOn,
          }
        }),
      }

      const response = await fetch(`/api/suppliers/${editingSupplier.supplierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        console.error("[EDIT_SUPPLIER_SAVE_ERROR]", {
          status: response.status,
          error: data.error,
          fullResponse: data,
        })
        throw new Error(data.error || "Failed to update supplier")
      }

      successAction("Supplier updated")
      setEditSupplierModalOpen(false)
      setEditingSupplier(null)
      await loadSuppliers()
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to update supplier")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSupplierFromList = async (supplierId: number) => {
    const confirmDelete = window.confirm("Delete this supplier and all linked products?")
    if (!confirmDelete) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete supplier")
      }

      successAction("Supplier deleted")
      await loadSuppliers()
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to delete supplier")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditProduct = (product: ProductRow) => {
    setEditingProduct(product)
    setEditProductForm({ ...product })
    setEditProductModalOpen(true)
  }

  const handleSaveEditProduct = () => {
    if (!editingProduct) return
    updateProductRow(editingProduct.rowId, editProductForm)
    setEditProductModalOpen(false)
    setEditingProduct(null)
  }

  const handleEditSupplierProductFieldChange = (rowId: string, field: keyof ProductRow, value: string) => {
    if (field === "mrp") {
      const newMRP = value
      const current = editSupplierProducts.find(r => r.rowId === rowId)
      const sgst = current?.sgstRate || "0"
      const cgst = current?.cgstRate || "0"
      const igst = current?.igstRate || "0"
      const newSale = computeSalePriceFromMRP(newMRP, sgst, cgst, igst)
      setEditSupplierProducts(prev => prev.map(r => r.rowId === rowId ? { ...r, mrp: newMRP, salePrice: newSale } : r))
      return
    }

    if (field === "igstRate") {
      const newIgst = value
      const igstNum = toNumber(newIgst)
      const half = (igstNum / 2).toFixed(2)
      const newSgst = half
      const newCgst = half
      const current = editSupplierProducts.find(r => r.rowId === rowId)
      const newSale = computeSalePriceFromMRP(current?.mrp || "0", newSgst, newCgst, newIgst)
      setEditSupplierProducts(prev => prev.map(r => r.rowId === rowId ? { ...r, igstRate: String(newIgst), sgstRate: String(newSgst), cgstRate: String(newCgst), salePrice: newSale } : r))
      return
    }

    setEditSupplierProducts(prev => prev.map(r => r.rowId === rowId ? { ...r, [field]: value } : r))
  }

  const removeEditSupplierProductRow = (rowId: string) => {
    setEditSupplierProducts(prev => {
      const filtered = prev.filter(r => r.rowId !== rowId)
      return filtered.length > 0 ? filtered : [createEmptyProductRow()]
    })
  }

  useEffect(() => {
    if (!showNewSupplierStateDropdown || newSupplierStateSelectedIndex < 0) return
    const el = newSupplierStateOptionRefs.current[newSupplierStateSelectedIndex]
    if (el) {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [newSupplierStateSelectedIndex, showNewSupplierStateDropdown])

  const handleSaveRef = useRef(handleSave)
  const handleClearRef = useRef(handleClearNew)
  handleSaveRef.current = handleSave
  handleClearRef.current = handleClearNew

  useEffect(() => {
    const onSave = () => handleSaveRef.current()
    const onClear = () => handleClearRef.current()
    window.addEventListener("inventoryProducts:save", onSave)
    window.addEventListener("inventoryProducts:clear", onClear)
    return () => {
      window.removeEventListener("inventoryProducts:save", onSave)
      window.removeEventListener("inventoryProducts:clear", onClear)
    }
  }, [])

  return (
    <>
        {/* Tab Panels (rendered conditionally) */}
        {activeTab === "suppliers" && (
          <div className="global-subform-table-content flex min-h-0 flex-col">
            {isLoadingList ? (
              <p className="text-sm text-muted-foreground">Loading suppliers...</p>
            ) : visibleSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suppliers found</p>
            ) : (
              <div className="form-table-wrapper supplier-product-table-wrapper shrink-0">
                <table className="w-full table-fixed text-sm">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="bg-slate-100 text-center" style={{ width: "25%" }}>Supplier Name</th>
                      <th className="bg-slate-100 text-center" style={{ width: "10%" }}>Mobile No</th>
                      <th className="bg-slate-100 text-center" style={{ width: "10%" }}>State</th>
                      <th className="bg-slate-100 text-center" style={{ width: "25%" }}>GSTIN</th>
                      <th className="bg-slate-100 text-center" style={{ width: "25%" }}>PAN</th>
                      <th className="bg-slate-100 text-center" style={{ width: "5%" }}>Products</th>
                      <th className="bg-slate-100 text-center" style={{ width: "10%" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="[&_td]:text-center">
                    {visibleSuppliers.map((supplier) => (
                      <tr key={supplier.supplierId}>
                        <td>{supplier.supplierName}</td>
                        <td>{supplier.mobileNo}</td>
                        <td>{supplier.stateName || "-"}</td>
                        <td>-</td>
                        <td>-</td>
                        <td className="font-medium">{supplier._count.products}</td>
                        <td>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditSupplier(supplier)}
                              aria-label="Edit"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSupplierFromList(supplier.supplierId)}
                              aria-label="Delete"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="shrink-0">
              <Button
                type="button"
                onClick={() => setAddSupplierDialogOpen(true)}
                className="global-bottom-btn-add"
                variant="ghost"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            </div>
          </div>
        )}

        {activeTab === "products" && (
          <>
            <div className="global-subform-table-content flex min-h-0 flex-col">
              {selectedSupplierId && (
                <div className="form-table-wrapper supplier-product-table-wrapper shrink-0">
                  <table className="w-full table-fixed text-sm">
                    <thead className="sticky top-0 z-20">
                      <tr>
                        <th className="bg-slate-100 text-center" style={{ width: "30%" }}>Product Name</th>
                        <th className="bg-slate-100 text-center" style={{ width: "10%" }}>Unit</th>
                        <th className="bg-slate-100 text-center" style={{ width: "10%" }}>MRP</th>
                        <th className="bg-slate-100 text-center" style={{ width: "10%" }}>Purchase Price</th>
                        <th className="bg-slate-100 text-center" style={{ width: "10%" }}>Sale Price</th>
                        <th className="bg-slate-100 text-center" style={{ width: "10%" }}>HSN Code</th>
                        <th className="bg-slate-100 text-center" style={{ width: "7%" }}>{isSameStateAsShop ? "SGST %" : "IGST %"}</th>
                        {isSameStateAsShop && <th className="bg-slate-100 text-center" style={{ width: "7%" }}>CGST %</th>}
                        <th className="bg-slate-100 text-center" style={{ width: "6%" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                    {visibleProducts.map((row) => (
                      <tr key={row.rowId} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-left" style={{width: '30%'}}>
                          <input
                            type="text"
                            value={row.productName}
                            onChange={(e) => handleProductFieldChange(row.rowId, "productName", e.target.value)}
                            onInput={(e) => handleProductFieldChange(row.rowId, "productName", (e.target as HTMLInputElement).value)}
                            placeholder="Enter product name"
                            data-product-id={row.rowId}
                            data-field="productName"
                            className="w-full px-2 py-1 border border-border/90 rounded bg-muted/30 text-sm text-left focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        </td>
                        <td className="p-3 text-center" style={{width: '10%'}}>
                          <select
                            value={row.unit}
                            onChange={(e) => handleProductFieldChange(row.rowId, "unit", e.target.value)}
                            data-product-id={row.rowId}
                            data-field="unit"
                            className="w-full px-2 py-1 border-0 rounded bg-transparent text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-400"
                          >
                            <option value="">-</option>
                            {unitOptions.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-center" style={{width: '10%'}}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.mrp}
                            onChange={(e) => handleProductFieldChange(row.rowId, "mrp", e.target.value)}
                            onInput={(e) => handleProductFieldChange(row.rowId, "mrp", (e.target as HTMLInputElement).value)}
                            placeholder="0"
                            data-product-id={row.rowId}
                            data-field="mrp"
                            className="w-full px-2 py-1 border border-border/90 rounded bg-muted/30 text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        </td>
                        <td className="p-3 text-center" style={{width: '10%'}}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.purchasePrice}
                            onChange={(e) => handleProductFieldChange(row.rowId, "purchasePrice", e.target.value)}
                            onInput={(e) => handleProductFieldChange(row.rowId, "purchasePrice", (e.target as HTMLInputElement).value)}
                            placeholder="0"
                            data-product-id={row.rowId}
                            data-field="purchasePrice"
                            className="w-full px-2 py-1 border border-border/90 rounded bg-muted/30 text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        </td>
                        <td className="p-3 text-center" style={{width: '10%'}}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.salePrice}
                            disabled
                            placeholder="0"
                            className="w-full px-2 py-1 border border-border/90 rounded bg-gray-100 text-sm text-center text-gray-500 cursor-not-allowed"
                          />
                        </td>
                        <td className="p-3 text-center" style={{width: '10%'}}>
                          <input
                            type="text"
                            value={row.hsnCode}
                            onChange={(e) => handleProductFieldChange(row.rowId, "hsnCode", e.target.value)}
                            onInput={(e) => handleProductFieldChange(row.rowId, "hsnCode", (e.target as HTMLInputElement).value)}
                            placeholder="HSN"
                            data-product-id={row.rowId}
                            data-field="hsnCode"
                            className="w-full px-2 py-1 border border-border/90 rounded bg-muted/30 text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        </td>
                        <td className="p-3 text-center" style={{width: '7%'}}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={isSameStateAsShop ? row.sgstRate : row.igstRate}
                            onChange={(e) => {
                              if (isSameStateAsShop) {
                                handleProductFieldChange(row.rowId, "sgstRate", e.target.value)
                                handleProductFieldChange(row.rowId, "cgstRate", e.target.value)
                              } else {
                                handleProductFieldChange(row.rowId, "igstRate", e.target.value)
                              }
                            }}
                            onInput={(e) => {
                              if (isSameStateAsShop) {
                                handleProductFieldChange(row.rowId, "sgstRate", (e.target as HTMLInputElement).value)
                                handleProductFieldChange(row.rowId, "cgstRate", (e.target as HTMLInputElement).value)
                              } else {
                                handleProductFieldChange(row.rowId, "igstRate", (e.target as HTMLInputElement).value)
                              }
                            }}
                            placeholder="0"
                            data-product-id={row.rowId}
                            data-field={isSameStateAsShop ? "sgstRate" : "igstRate"}
                            className="w-full px-2 py-1 border border-border/90 rounded bg-muted/30 text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        </td>
                        {isSameStateAsShop && (
                          <td className="p-3 text-center" style={{width: '7%'}}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.cgstRate}
                              disabled
                              placeholder="0"
                              className="w-full px-2 py-1 border border-border/90 rounded bg-gray-100 text-sm text-center text-gray-500 cursor-not-allowed"
                            />
                          </td>
                        )}
                        <td className="p-3 text-center" style={{width: '6%'}}>
                          <button
                            type="button"
                            onClick={() => removeProductRowLocal(row.rowId)}
                            className="px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
            )}

            {!selectedSupplierId && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center py-8">
                <p className="text-sm text-muted-foreground">Please select a supplier from the dropdown above to manage products</p>
              </div>
            )}
            </div>

            {/* Add Product row */}
            {selectedSupplierId && (
              <div className="shrink-0 mt-4">
                <Button
                  type="button"
                  onClick={() => addProductRow()}
                  className="global-bottom-btn-add"
                  variant="ghost"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>
            )}
          </>
        )}

      {/* Add Supplier Dialog */}
      <Dialog open={addSupplierDialogOpen} onOpenChange={(open) => {
        setAddSupplierDialogOpen(open)
        if (!open) {
          setEditingFromListId(null)
          setNewSupplierForm(defaultSupplierForm())
          setNewSupplierStateFilter("")
          setShowNewSupplierStateDropdown(false)
          setNewSupplierStateSelectedIndex(-1)
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              {editingFromListId !== null ? "Edit Supplier" : "Add New Supplier"}
            </DialogTitle>
            <DialogDescription>
              {editingFromListId !== null ? "Update supplier details." : "Enter the supplier details to create a new supplier record."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="space-y-2">
                <Label htmlFor="new-supplier-name">Supplier Name *</Label>
                <Input
                  id="new-supplier-name"
                  value={newSupplierForm.supplierName}
                  onChange={(e) => setNewSupplierForm((prev) => ({ ...prev, supplierName: e.target.value }))}
                  placeholder="Enter supplier name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-mobile">Mobile Number</Label>
                <Input
                  id="new-mobile"
                  value={newSupplierForm.mobileNo}
                  onChange={(e) => setNewSupplierForm((prev) => ({ ...prev, mobileNo: normalizeMobileNumber(e.target.value) }))}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="Enter mobile number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-state-name">State</Label>
                <Popover
                  open={showNewSupplierStateDropdown}
                  onOpenChange={(open) => {
                    setShowNewSupplierStateDropdown(open)
                    if (!open) {
                      setNewSupplierStateSelectedIndex(-1)
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <div className="w-full">
                      <Input
                        id="new-state-name"
                        placeholder="Search and select state..."
                        value={newSupplierStateFilter}
                        onChange={(e) => {
                          setNewSupplierStateFilter(e.target.value)
                          setShowNewSupplierStateDropdown(true)
                          setNewSupplierStateSelectedIndex(-1)
                        }}
                        onKeyDown={(e) => {
                          if (!showNewSupplierStateDropdown) return

                          const filteredStates = availableStates.filter(state =>
                            newSupplierStateFilter === "" ||
                            state.stateName.toLowerCase().includes(newSupplierStateFilter.toLowerCase()) ||
                            (state.stateCode && state.stateCode.toLowerCase().includes(newSupplierStateFilter.toLowerCase()))
                          )

                          switch (e.key) {
                            case "ArrowDown":
                              e.preventDefault()
                              setNewSupplierStateSelectedIndex(prev =>
                                prev < filteredStates.length - 1 ? prev + 1 : prev
                              )
                              break
                            case "ArrowUp":
                              e.preventDefault()
                              setNewSupplierStateSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
                              break
                            case "Enter":
                              e.preventDefault()
                              if (newSupplierStateSelectedIndex >= 0 && filteredStates[newSupplierStateSelectedIndex]) {
                                const state = filteredStates[newSupplierStateSelectedIndex]
                                setNewSupplierForm((prev) => ({
                                  ...prev,
                                  stateName: String(state.stateName || ""),
                                  stateCode: String(state.stateCode || "")
                                }))
                                setNewSupplierStateFilter("")
                                setShowNewSupplierStateDropdown(false)
                                setNewSupplierStateSelectedIndex(-1)
                              }
                              break
                            case "Escape":
                              e.preventDefault()
                              setShowNewSupplierStateDropdown(false)
                              setNewSupplierStateSelectedIndex(-1)
                              break
                          }
                        }}
                        disabled={isLoadingStates}
                        autoComplete="off"
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    className="z-[100] w-[var(--radix-popover-trigger-width)] p-0 border-0 bg-transparent shadow-none"
                  >
                    <div
                      ref={newSupplierStateListRef}
                      className="dropdown-scroll"
                      onWheel={(e) => {
                        // Dialog scroll-lock can swallow wheel events; force scrolling on this list.
                        const el = newSupplierStateListRef.current
                        if (!el) return
                        el.scrollTop += e.deltaY
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                    >
                      {availableStates.length > 0 ? (
                        <>
                          {availableStates
                            .filter(state =>
                              newSupplierStateFilter === "" ||
                              state.stateName.toLowerCase().includes(newSupplierStateFilter.toLowerCase()) ||
                              (state.stateCode && state.stateCode.toLowerCase().includes(newSupplierStateFilter.toLowerCase()))
                            )
                            .map((state, index) => (
                              <button
                                key={state.stateId}
                                ref={(el) => {
                                  newSupplierStateOptionRefs.current[index] = el
                                }}
                                onClick={() => {
                                  setNewSupplierForm((prev) => ({
                                    ...prev,
                                    stateName: String(state.stateName || ""),
                                    stateCode: String(state.stateCode || "")
                                  }))
                                  setNewSupplierStateFilter("")
                                  setShowNewSupplierStateDropdown(false)
                                  setNewSupplierStateSelectedIndex(-1)
                                }}
                                className={`dropdown-item ${
                                  index === newSupplierStateSelectedIndex ? "selected" : ""
                                }`}
                              >
                                {state.stateName}
                              </button>
                            ))}
                        </>
                      ) : (
                        <div className="dropdown-empty-state">No states found</div>
                      )}
                    </div>
                    {newSupplierForm.stateName ? (
                      <div className="text-xs text-slate-500 mt-1">
                        Selected: {newSupplierForm.stateName}
                        {newSupplierForm.stateCode ? ` (${newSupplierForm.stateCode})` : ""}
                      </div>
                    ) : null}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-gstin">GSTIN</Label>
                <Input
                  id="new-gstin"
                  value={newSupplierForm.gstin}
                  onChange={(e) => setNewSupplierForm((prev) => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                  placeholder="Enter GSTIN"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pan">PAN</Label>
                <Input
                  id="new-pan"
                  value={newSupplierForm.pan}
                  onChange={(e) => setNewSupplierForm((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                  placeholder="Enter PAN"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-address-line-1">Address Line 1 (Building, Floor)</Label>
                <Input
                  id="new-address-line-1"
                  value={newSupplierForm.addressLine1}
                  onChange={(e) => setNewSupplierForm((prev) => ({ ...prev, addressLine1: e.target.value }))}
                  placeholder="Enter address line 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-address-line-2">Address Line 2 (Street Address)</Label>
                <Input
                  id="new-address-line-2"
                  value={newSupplierForm.addressLine2}
                  onChange={(e) => setNewSupplierForm((prev) => ({ ...prev, addressLine2: e.target.value }))}
                  placeholder="Enter address line 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-city">City</Label>
                <Input
                  id="new-city"
                  value={newSupplierForm.city}
                  onChange={(e) => setNewSupplierForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Enter city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-district">District</Label>
                <Input
                  id="new-district"
                  value={newSupplierForm.district}
                  onChange={(e) => setNewSupplierForm((prev) => ({ ...prev, district: e.target.value }))}
                  placeholder="Enter district"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-postal">Postal Code</Label>
                <Input
                  id="new-postal"
                  value={newSupplierForm.postalCode}
                  onChange={(e) => setNewSupplierForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                  placeholder="Enter postal code"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-5 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setAddSupplierDialogOpen(false)
                setNewSupplierForm(defaultSupplierForm())
                setEditingFromListId(null)
                setNewSupplierStateFilter("")
                setShowNewSupplierStateDropdown(false)
                setNewSupplierStateSelectedIndex(-1)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newSupplierForm.supplierName.trim()) {
                  errorAction("Supplier name is required")
                  return
                }

                const newSupplierMobileError = getMobileValidationMessage(newSupplierForm.mobileNo, "Supplier mobile number")
                if (newSupplierMobileError) {
                  errorAction(newSupplierMobileError)
                  return
                }
                try {
                  const isEditing = editingFromListId !== null
                  startAction(isEditing ? "Updating supplier..." : "Creating supplier...")
                  
                  const url = isEditing ? `/api/suppliers/${editingFromListId}` : "/api/suppliers"
                  const method = isEditing ? "PUT" : "POST"
                  
                  const payload = {
                    supplierName: String(newSupplierForm.supplierName || "").trim(),
                    address: composeAddress(
                      {
                        line1: newSupplierForm.addressLine1,
                        line2: newSupplierForm.addressLine2,
                        city: newSupplierForm.city,
                        district: newSupplierForm.district,
                        postalCode: newSupplierForm.postalCode,
                      },
                      { includeState: false }
                    ),
                    mobileNo: normalizeMobileNumber(newSupplierForm.mobileNo || ""),
                    stateCode: String(newSupplierForm.stateCode || "").trim(),
                    stateName: String(newSupplierForm.stateName || "").trim(),
                    gstin: String(newSupplierForm.gstin || "").trim(),
                    pan: String(newSupplierForm.pan || "").trim(),
                    createdOn: newSupplierForm.createdOn || toDateTimeLocalInput(),
                  }
                  
                  const response = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  })
                  const data = await response.json()
                  if (!response.ok) {
                    console.error("[SUPPLIER_DIALOG_SAVE_ERROR] Status:", response.status)
                    console.error("[SUPPLIER_DIALOG_SAVE_ERROR] Response:", JSON.stringify(data))
                    console.error("[SUPPLIER_DIALOG_SAVE_ERROR] Payload sent:", JSON.stringify(payload))
                    throw new Error(
                      data.details
                        ? `${data.error || "Failed to save supplier"}: ${data.details}`
                        : (data.error || (isEditing ? "Failed to update supplier" : "Failed to create supplier"))
                    )
                  }
                  successAction(isEditing ? "Supplier updated successfully" : "Supplier created successfully")
                  setAddSupplierDialogOpen(false)
                  setNewSupplierForm(defaultSupplierForm())
                  setNewSupplierStateFilter("")
                  setShowNewSupplierStateDropdown(false)
                  setNewSupplierStateSelectedIndex(-1)
                  setEditingFromListId(null)
                  await loadSuppliers()
                } catch (error) {
                  errorAction(error instanceof Error ? error.message : "Failed to save supplier")
                }
              }}
              className="bg-green-600 text-white hover:bg-green-700 px-4 py-2 min-h-[40px]"
            >
              {editingFromListId !== null ? "Update Supplier" : "Create Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={editProductModalOpen} onOpenChange={setEditProductModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Edit Product</DialogTitle>
            <DialogDescription>Update product details.</DialogDescription>
          </DialogHeader>
          
          <div className="global-form-shell space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label className="font-semibold">Product Name</Label>
                <Input
                  value={editProductForm.productName}
                  onChange={(e) => setEditProductForm(prev => ({ ...prev, productName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Unit</Label>
                <select
                  value={editProductForm.unit}
                  onChange={(e) => setEditProductForm(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
                >
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>
                      {u || "Select unit"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">HSN Code</Label>
                <Input
                  value={editProductForm.hsnCode}
                  onChange={(e) => setEditProductForm(prev => ({ ...prev, hsnCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">MRP</Label>
                <Input
                  type="number"
                  value={editProductForm.mrp}
                  onChange={(e) => {
                    const newMrp = e.target.value
                    const newSale = computeSalePriceFromMRP(newMrp, editProductForm.sgstRate, editProductForm.cgstRate, editProductForm.igstRate)
                    setEditProductForm(prev => ({ ...prev, mrp: newMrp, salePrice: newSale }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Purchase Price</Label>
                <Input
                  type="number"
                  value={editProductForm.purchasePrice}
                  onChange={(e) => setEditProductForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Sale Price</Label>
                <Input
                  type="number"
                  value={editProductForm.salePrice}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-sm text-gray-500 cursor-not-allowed focus:outline-none"
                />
              </div>
              {isSameStateAsShop ? (
                <>
                  <div className="space-y-2">
                    <Label className="font-semibold">SGST %</Label>
                    <Input
                      type="number"
                      value={editProductForm.sgstRate}
                      onChange={(e) => {
                        const newSgst = e.target.value
                        const newSale = computeSalePriceFromMRP(editProductForm.mrp, newSgst, newSgst, "0")
                        setEditProductForm(prev => ({ ...prev, sgstRate: newSgst, cgstRate: newSgst, igstRate: "0", salePrice: newSale }))
                      }}
                      className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">CGST %</Label>
                    <Input
                      type="number"
                      value={editProductForm.cgstRate}
                      disabled
                      placeholder="Same as SGST"
                      className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-sm text-gray-500 cursor-not-allowed focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label className="font-semibold">IGST %</Label>
                  <Input
                    type="number"
                    value={editProductForm.igstRate}
                    onChange={(e) => {
                      const newIgst = e.target.value
                      const igstNum = toNumber(newIgst)
                      const half = (igstNum / 2).toFixed(2)
                      const newSale = computeSalePriceFromMRP(editProductForm.mrp, half, half, newIgst)
                      setEditProductForm(prev => ({ ...prev, igstRate: newIgst, sgstRate: half, cgstRate: half, salePrice: newSale }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-5 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setEditProductModalOpen(false)
                setEditingProduct(null)
              }}
              className="px-4 py-2 min-h-[40px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditProduct}
              className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 min-h-[40px]"
            >
              Update Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DatePickerInput from '@/components/ui/date-picker-input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { notify } from '@/components/ui/notify'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Printer, Trash2, Eye, X, Save, PlusCircle, Eye as EyeIcon } from 'lucide-react'
import { formatDateDDMMYY, getTodayISODateInIndia, parseDDMMYYToISO } from '@/lib/utils'
import { CustomerStateModal } from '@/components/dashboard/customer-state-modal'

interface SaleLineItem {
  id: string
  // optional DB id for sale detail (when editing existing sale)
  saleDetailsId?: number
  productId: number
  product: string
  description?: string
  hsn?: string
  qnty: number
  salePrice: number
  sgstRate: number
  cgstRate: number
  igstRate?: number
  discount: number
  returnQnty: number
  returnDate?: string
  amount: number
  discountAmount: number
  sgstAmount: number
  cgstAmount: number
  igstAmount?: number
  totalAmount: number
}

interface Product {
  productId: number
  productName: string
  hsnCode: string
  unit: string
  salePrice: number
  purchasePrice: number
  sgstRate: number
  cgstRate: number
  igstRate?: number
  balanceStock: number
  productDescription?: string
  stock?: number
  product?: string
}

interface CustomerOption {
  customerId?: string
  customerName?: string
  id?: string
  name?: string
  mobileNo?: string
  mobile?: string
  stateId?: string | number | null
  state?: string | null
}

interface SaleApiDetail {
  saleDetailsId?: number
  productId: number
  product: string
  productDescription?: string
  hsn?: string
  qnty?: number
  salePrice?: number
  sgstRate?: number
  cgstRate?: number
  igstRate?: number
  discount?: number
  returnQnty?: number
  returnDate?: string | null
  amount?: number
  discountAmount?: number
  sgstAmount?: number
  cgstAmount?: number
  igstAmount?: number
  totalAmount?: number
}

interface SaleApiRecord {
  saleId?: number
  billNumber?: string
  billDate?: string
  createdAt?: string
  customer?: string
  mobileNo?: string
  stateCode?: string | null
  stateName?: string | null
  saleDetails?: SaleApiDetail[]
}

interface SummaryStats {
  todaysSales: number
  totalCustomers: number
  returns: number
  totalRevenue: number
}

export function POSSalesForm() {
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)
  const [billDate, setBillDate] = useState(formatDateDDMMYY(getTodayISODateInIndia()))
  const [billNumber, setBillNumber] = useState('')

  const [lineItems, setLineItems] = useState<SaleLineItem[]>([])
  const [deletedDetailIds, setDeletedDetailIds] = useState<number[]>([])
  // product search removed: product selection happens via table cell picker
  const [purchaseProducts, setPurchaseProducts] = useState<Product[]>([])
  const [pickerState, setPickerState] = useState<{ open: boolean; anchorId: string | null; highlight: number }>({ open: false, anchorId: null, highlight: 0 })
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const [pickerFilter, setPickerFilter] = useState<string>('')
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number; width?: number }>({ top: 0, left: 0 })
  const qtyInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const stockToastShownRef = useRef<Record<string, boolean>>({})
  const tableContainerRef = useRef<HTMLDivElement | null>(null)

  // Modal for viewing product details and keyboard selection
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productModalAnchor, setProductModalAnchor] = useState<string | null>(null)
  const [productModalFilter, setProductModalFilter] = useState<string>('')
  const [productModalHighlight, setProductModalHighlight] = useState<number>(0)
  const productModalRef = useRef<HTMLDivElement | null>(null)
  const productRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({})
  const mobileInputRef = useRef<HTMLInputElement | null>(null)
  const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false)
  const [isHeaderPrepared, setIsHeaderPrepared] = useState(false)
  const [customerStateCode, setCustomerStateCode] = useState('')
  const [customerStateName, setCustomerStateName] = useState('')
  const [showCustomerStateModal, setShowCustomerStateModal] = useState(false)
  const [pendingHeaderSave, setPendingHeaderSave] = useState(false)

  const showWarn = (title: string, description?: string) =>
    notify.error(description ? `${title}: ${description}` : title)

  const showSuccess = (title: string, description?: string) =>
    notify.success(description ? `${title}: ${description}` : title)

  const hasBillHeaderBasics = () =>
    Boolean(
      (customerSearch || '').toString().trim() &&
      (customerMobile || '').toString().trim() &&
      (billDate || '').toString().trim()
    )

  const ensureSaleRowAccess = () => {
    if (!hasBillHeaderBasics()) {
      showWarn('Validation', 'Please add bill header details first')
      setIsAddBillModalOpen(true)
      return false
    }

    if (!customerStateCode.trim()) {
      showWarn('Validation', 'Please add customer state before adding sale rows')
      setShowCustomerStateModal(true)
      return false
    }

    if (!isHeaderPrepared) {
      setIsAddBillModalOpen(true)
      return false
    }

    return true
  }

  function openProductModal(anchor: string | null, filter = '') {
    if (!ensureSaleRowAccess()) {
      return
    }
    ensurePurchaseProducts()
    setProductModalAnchor(anchor)
    setProductModalFilter(filter)
    setProductModalHighlight(0)
    setProductModalOpen(true)
  }

  const openPickerFor = (target: HTMLElement, anchorId: string | null, initialFilter = '') => {
    ensurePurchaseProducts()
    try {
      const rect = target.getBoundingClientRect()
      setPickerPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width })
      setPickerState({ open: true, anchorId, highlight: 0 })
      setPickerFilter(initialFilter)
    } catch {
    }
  }

  async function fetchLatestPurchaseProducts() {
    try {
      const res = await fetch('/api/products', { cache: 'force-cache' })
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data)) return
      const normalized: Product[] = data.map((p: Record<string, unknown>) => ({
        productId: Number(p.productId || 0),
        productName: String(p.productName || p.product || ''),
        purchasePrice: Number(p.purchasePrice || 0),
        salePrice: Number(p.salePrice || p.purchasePrice || 0),
        hsnCode: String(p.hsnCode || p.hsn || ''),
        unit: String(p.unit || ''),
        sgstRate: Number(p.sgstRate || p.sgst_rate || 0),
        cgstRate: Number(p.cgstRate || p.cgst_rate || 0),
        igstRate: Number(p.igstRate || p.igst_rate || 0),
        balanceStock: Number(p.balanceStock || p.stock || 0),
        productDescription: String(p.productDescription || ''),
        product: String(p.product || ''),
        stock: Number(p.stock || 0),
      }))
      setPurchaseProducts(normalized)
    } catch (err) {
      console.warn('[pos-sales] failed to fetch products', err)
    }
  }

  const ensurePurchaseProducts = () => {
    if (purchaseProducts.length === 0) {
      // provide immediate mock options so picker shows instantly
      const mock: Product[] = []
      for (let i = 1; i <= 20; i++) {
        mock.push({
          productId: 1000 + i,
          productName: `Test Product ${i}`,
          purchasePrice: Number((50 + i).toFixed(2)),
          salePrice: Number((60 + i).toFixed(2)),
          hsnCode: `HSN${i}`,
          unit: 'Pcs',
          sgstRate: 0,
          cgstRate: 0,
          igstRate: 0,
          balanceStock: 100,
          stock: 100,
          productDescription: '',
        })
      }
      setPurchaseProducts(mock)
      // also fetch real data in background
      fetchLatestPurchaseProducts()
    }
  }

  // Picker keyboard handling
  useEffect(() => {
    if (!pickerState.open) return
    const onKey = (e: KeyboardEvent) => {
      if (!pickerState.open) return
      const filtered = purchaseProducts.filter((pp) => String(pp.productName || '').toLowerCase().includes(String(pickerFilter || '').toLowerCase()))
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPickerState((p) => ({ ...p, highlight: Math.min(p.highlight + 1, Math.max(0, filtered.length - 1)) }))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPickerState((p) => ({ ...p, highlight: Math.max(p.highlight - 1, 0) }))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const idx = pickerState.highlight
        const prod = filtered[idx]
        if (prod) selectProduct(prod, pickerState.anchorId)
      } else if (e.key === 'Escape') {
        setPickerState({ open: false, anchorId: null, highlight: 0 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickerState.open, pickerState.highlight, purchaseProducts])

  // click outside to close picker
  useEffect(() => {
    if (!pickerState.open) return
    const onClick = (e: MouseEvent) => {
      const el = pickerRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setPickerState({ open: false, anchorId: null, highlight: 0 })
      }
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [pickerState.open])

  // Keyboard navigation & outside click for product modal
  useEffect(() => {
    if (!productModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      const filtered = purchaseProducts.filter((pp) => String(pp.productName || '').toLowerCase().includes(String(productModalFilter || '').toLowerCase()))
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setProductModalHighlight(h => Math.min(h + 1, Math.max(0, filtered.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setProductModalHighlight(h => Math.max(h - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const prod = filtered[productModalHighlight]
        if (prod) {
          selectProduct(prod, productModalAnchor)
          setProductModalOpen(false)
        }
      } else if (e.key === 'Escape') {
        setProductModalOpen(false)
      }
    }
    const onClickOutside = (e: MouseEvent) => {
      const el = productModalRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setProductModalOpen(false)
    }
    // add key handler immediately
    window.addEventListener('keydown', onKey)
    // delay adding click handler so the opening click doesn't immediately close the modal
    const t = setTimeout(() => window.addEventListener('click', onClickOutside), 50)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClickOutside)
      clearTimeout(t)
    }
  }, [productModalOpen, productModalHighlight, purchaseProducts, productModalFilter, productModalAnchor])

  // focus the highlighted row in the product modal when highlight changes
  useEffect(() => {
    if (!productModalOpen) return
    const el = productRowRefs.current[productModalHighlight]
    try { if (el) (el as HTMLElement).focus() } catch {}
  }, [productModalHighlight, productModalOpen])

  // Load customers for suggestions
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/customers', { cache: 'force-cache' })
        if (!res.ok) return
        const rows = await res.json()
        if (Array.isArray(rows)) setCustomers(rows)
      } catch (err) {
        console.warn('[pos-sales] failed to load customers', err)
      }
    }
    load()
  }, [])

  

  const selectProduct = (prod: Product, anchorId: string | null) => {
    if (!ensureSaleRowAccess()) {
      setPickerState({ open: false, anchorId: null, highlight: 0 })
      return
    }

    const productObj: Product = {
      productId: prod.productId,
      productName: prod.productName,
      hsnCode: prod.hsnCode || '',
      unit: prod.unit || '',
      salePrice: prod.salePrice || prod.purchasePrice || 0,
      purchasePrice: prod.purchasePrice || 0,
      sgstRate: Number(prod.sgstRate || 0),
      cgstRate: Number(prod.cgstRate || 0),
      balanceStock: Number(prod.balanceStock || 0),
    }

      if (!anchorId || anchorId === 'new') {
      // add new line
      const newId = addLineItem(productObj)
      // focus qty of newly added row after render
      if (newId) {
        setTimeout(() => {
          try { qtyInputRefs.current[newId]?.focus() } catch {}
        }, 50)
      }
    } else {
      // replace existing line item product - use updateLineItem to recalc totals
      updateLineItem(anchorId, {
        productId: productObj.productId,
        product: productObj.productName,
        description: productObj.productDescription || undefined,
        hsn: productObj.hsnCode,
        salePrice: productObj.salePrice,
        sgstRate: productObj.sgstRate,
        cgstRate: productObj.cgstRate,
        igstRate: productObj.igstRate || 0,
      } as Partial<SaleLineItem>)
    }

    setPickerState({ open: false, anchorId: null, highlight: 0 })
    setUnsavedChanges(true)
    setPickerFilter('')
  }
  const [isLoading, setIsLoading] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [stockWarnings, setStockWarnings] = useState<{ [key: string]: boolean }>({})
  const [newRowDefaults, setNewRowDefaults] = useState<{ qnty: number; discountAmount: number }>({ qnty: 1, discountAmount: 0 })
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  // search modal for loading existing sale by bill
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchBillQuery, setSearchBillQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SaleApiRecord[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchHighlight, setSearchHighlight] = useState(0)
  const [saleId, setSaleId] = useState<number | null>(null)

  // inline bill search
  const [saleBillInput, setSaleBillInput] = useState('')
  const [saleBillAllResults, setSaleBillAllResults] = useState<SaleApiRecord[]>([])
  const [isSaleBillOpen, setIsSaleBillOpen] = useState(false)
  const [isSaleBillLoading, setIsSaleBillLoading] = useState(false)
  const [saleBillHighlight, setSaleBillHighlight] = useState(0)
  const [summary, setSummary] = useState<SummaryStats>({ todaysSales: 0, totalCustomers: 0, returns: 0, totalRevenue: 0 })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [customerMobile, setCustomerMobile] = useState<string>(selectedCustomer?.mobileNo || '')

  // modal edit state
  const [modalEditingSale, setModalEditingSale] = useState<SaleApiRecord | null>(null)
  const [modalEditingLines, setModalEditingLines] = useState<SaleLineItem[]>([])
  const [modalSaving, setModalSaving] = useState(false)

  const resetSaleForm = () => {
    setSelectedCustomer(null)
    setCustomerSearch('')
    setCustomerMobile('')
    setBillDate(formatDateDDMMYY(getTodayISODateInIndia()))
    setBillNumber('')
    setCustomerStateCode('')
    setCustomerStateName('')
    setIsHeaderPrepared(false)
    setPendingHeaderSave(false)
    setLineItems([])
    setSaleId(null)
    setDeletedDetailIds([])
    setStockWarnings({})
    setUnsavedChanges(false)
  }

  const completeHeaderSetup = () => {
    setIsHeaderPrepared(true)
    setPendingHeaderSave(false)
    setIsAddBillModalOpen(false)
    setUnsavedChanges(true)
  }

  const prepareBillHeader = () => {
    const name = (customerSearch || '').trim()
    const mobile = (customerMobile || '').replace(/\D/g, '').slice(0, 10)

    if (!name) {
      showWarn('Validation', 'Please enter customer name')
      return
    }

    if (mobile.length !== 10) {
      showWarn('Validation', 'Mobile number must be 10 digits')
      setTimeout(() => { try { mobileInputRef.current?.focus() } catch {} }, 10)
      return
    }

    const billDateIso = parseDDMMYYToISO(billDate)
    if (!billDateIso) {
      showWarn('Validation', 'Enter bill date in dd-mm-yy format')
      return
    }

    setCustomerMobile(mobile)

    const selectedState = selectedCustomer?.stateId ? String(selectedCustomer.stateId) : ''
    const selectedStateName = selectedCustomer?.state ? String(selectedCustomer.state) : ''
    if (!customerStateCode && selectedState) {
      setCustomerStateCode(selectedState)
      setCustomerStateName(selectedStateName)
    }

    if (!(customerStateCode || selectedState).trim()) {
      showWarn('Validation', 'Customer state is required for invoice')
      setPendingHeaderSave(true)
      setShowCustomerStateModal(true)
      return
    }

    completeHeaderSetup()
  }

  const handleSaveCustomerState = (stateId: string, stateName: string) => {
    setCustomerStateCode(stateId)
    setCustomerStateName(stateName)
    if (pendingHeaderSave) {
      completeHeaderSetup()
    }
  }

  const startFreshBill = () => {
    resetSaleForm()
    setIsAddBillModalOpen(true)
  }

  // Check stock availability
  // Prevent navigating into the items table when top-row fields are incomplete
  useEffect(() => {
    const el = tableContainerRef.current
    if (!el) return
    const onFocusIn = (ev: FocusEvent) => {
      const target = ev.target as HTMLElement | null
      if (!ensureSaleRowAccess() && target && el.contains(target)) {
        try { target.blur() } catch {}
      }
    }
    el.addEventListener('focusin', onFocusIn)
    return () => el.removeEventListener('focusin', onFocusIn)
  }, [customerSearch, customerMobile, billDate, customerStateCode, isHeaderPrepared])
  const checkStockWarning = (productId: number, qnty: number, itemId: string) => {
    let product: Product | undefined = products.find((p) => p.productId === productId)
    if (!product) {
      // fallback to purchaseProducts if main products list not loaded
      product = purchaseProducts.find((p) => p.productId === productId)
    }
    const existingQnty = lineItems
      .filter((item) => item.productId === productId && item.id !== itemId)
      .reduce((sum, item) => sum + item.qnty, 0)

    const available = product ? Number(product.balanceStock || product.stock || 0) - existingQnty : null
    const isWarning = available !== null ? existingQnty + qnty > (product?.balanceStock ?? product?.stock ?? 0) : false

    if (isWarning) {
      setStockWarnings((prev) => ({ ...prev, [itemId]: true }))
    } else {
      setStockWarnings((prev) => {
        const newState = { ...prev }
        delete newState[itemId]
        return newState
      })
    }

    return { isWarning, available }
  }

  // Calculate line totals
  const calculateLineTotal = (
    qnty: number,
    salePrice: number,
    discount: number,
    sgstRate: number,
    cgstRate: number,
    igstRate: number
  ) => {
    const amount = qnty * salePrice
    const discountAmount = (amount * discount) / 100
    const accessAmount = amount - discountAmount
    const sgstAmount = (accessAmount * sgstRate) / 100
    const cgstAmount = (accessAmount * cgstRate) / 100
    const igstAmount = (accessAmount * igstRate) / 100
    const totalAmount = accessAmount + sgstAmount + cgstAmount + igstAmount

    return { amount, discountAmount, accessAmount, sgstAmount, cgstAmount, igstAmount, totalAmount }
  }

  // Add line item
  const addLineItem = (product: Product) => {
    if (!ensureSaleRowAccess()) {
      return
    }
          const qnty = newRowDefaults.qnty || 1
          const salePrice = product.salePrice || 0
          const discountAmountInput = newRowDefaults.discountAmount || 0
          const baseAmount = qnty * salePrice
          const discountPercent = baseAmount > 0 ? (discountAmountInput / baseAmount) * 100 : 0

          const totals = calculateLineTotal(qnty, salePrice, discountPercent, product.sgstRate || 0, product.cgstRate || 0, product.igstRate || 0)

          const newItem: SaleLineItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: product.productId,
      product: product.productName,
      description: product.productDescription || '',
      hsn: product.hsnCode || '',
            qnty,
            salePrice,
            sgstRate: product.sgstRate,
            cgstRate: product.cgstRate,
            igstRate: product.igstRate || 0,
            discount: discountPercent,
            returnQnty: 0,
            amount: totals.amount,
            discountAmount: totals.discountAmount,
            sgstAmount: totals.sgstAmount,
            cgstAmount: totals.cgstAmount,
            igstAmount: totals.igstAmount,
            totalAmount: totals.totalAmount,
    }
    setLineItems([...lineItems, newItem])
    // set visual warning if needed
    try { checkStockWarning(product.productId, qnty, newItem.id) } catch {}
    setUnsavedChanges(true)
    // reset new row defaults
          setNewRowDefaults({ qnty: 1, discountAmount: 0 })
    return newItem.id
  }

  const addEmptyLineItem = () => {
    if (!ensureSaleRowAccess()) {
      return
    }

    const newItem: SaleLineItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: 0,
      product: '',
      description: '',
      hsn: '',
      qnty: 1,
      salePrice: 0,
      sgstRate: 0,
      cgstRate: 0,
      igstRate: 0,
      discount: 0,
      returnQnty: 0,
      amount: 0,
      discountAmount: 0,
      sgstAmount: 0,
      cgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
    }

    setLineItems((prev) => [...prev, newItem])
    setUnsavedChanges(true)
  }

  // Update line item
  const updateLineItem = (id: string, updates: Partial<SaleLineItem>) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, ...updates }
          const { amount, discountAmount, accessAmount, sgstAmount, cgstAmount, igstAmount, totalAmount } =
            calculateLineTotal(
              updatedItem.qnty,
              updatedItem.salePrice,
              updatedItem.discount,
              updatedItem.sgstRate,
              updatedItem.cgstRate,
              updatedItem.igstRate || 0
            )
          if ('qnty' in updates) {
            try { checkStockWarning(updatedItem.productId, updatedItem.qnty, id) } catch {}
          }
          return {
            ...updatedItem,
            amount,
            discountAmount,
            sgstAmount,
            cgstAmount,
            igstAmount,
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
    const item = lineItems.find((it) => it.id === id)
    if (!item) return
    // if editing an existing saved sale and this line exists in DB, track its detail id for deletion
    if (saleId && item.saleDetailsId) {
      const sid = Number(item.saleDetailsId)
      if (!Number.isNaN(sid)) setDeletedDetailIds((prev) => Array.from(new Set([...prev, sid])))
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id))
    setStockWarnings((prev) => {
      const newState = { ...prev }
      delete newState[id]
      return newState
    })
    setUnsavedChanges(true)
  }

  // Calculate totals
  const totals = lineItems.reduce(
    (acc, item) => ({
      amount: acc.amount + item.amount,
      discount: acc.discount + item.discountAmount,
      sgst: acc.sgst + (item.sgstAmount || 0),
      cgst: acc.cgst + (item.cgstAmount || 0),
      igst: acc.igst + (item.igstAmount || 0),
      total: acc.total + item.totalAmount,
    }),
    { amount: 0, discount: 0, sgst: 0, cgst: 0, igst: 0, total: 0 }
  )

  // Save sale
  const handleSave = async () => {
    if (!customerStateCode.trim()) {
      showWarn('Validation Error', 'Please add customer state before saving')
      setShowCustomerStateModal(true)
      return
    }

    if (lineItems.length === 0) {
      showWarn('Validation Error', 'Please add at least one product')
      return
    }

    if ((customerMobile || '').length !== 10) {
      showWarn('Validation Error', 'Enter a 10-digit mobile number')
      setTimeout(() => { try { mobileInputRef.current?.focus() } catch {} }, 10)
      return
    }

    // Check stock warnings - show product-specific toasts and focus first offending qty
    const offendingIds = Object.keys(stockWarnings || {})
    if (offendingIds.length > 0) {
      // show toast for each offending row (avoid spamming via stockToastShownRef)
      let firstId: string | null = null
      for (const id of offendingIds) {
        const item = lineItems.find((li) => li.id === id)
        if (!item) continue
        try {
          const res = checkStockWarning(item.productId, item.qnty, id)
          const isWarn = !!res && res.isWarning
          const available = res && res.available
          if (isWarn) {
            const prod = products.find((p) => p.productId === item.productId) || purchaseProducts.find((p) => p.productId === item.productId)
            const name = prod ? (prod.productName || prod.product || '') : (item.product || '')
            const availText = typeof available === 'number' ? ` (available ${available})` : ''
            if (!stockToastShownRef.current[id]) {
              showWarn('Stock Alert', `${name}: entered ${item.qnty}${availText}`)
              stockToastShownRef.current[id] = true
            }
            if (!firstId) firstId = id
          }
        } catch {}
      }
      // focus first offending qty input
      if (firstId) {
        setTimeout(() => { try { qtyInputRefs.current[firstId!]?.focus() } catch {} }, 50)
      }
      return
    }

    setIsLoading(true)
    try {
      const billDateIso = parseDDMMYYToISO(billDate)
      if (!billDateIso) {
        showWarn('Validation', 'Bill Date must be in dd-mm-yy format')
        setIsLoading(false)
        return
      }

      const method = saleId ? 'PUT' : 'POST'
      const url = saleId ? `/api/sales/${saleId}` : '/api/sales'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billNumber,
          billDate: billDateIso,
          customer: customerSearch.trim() || selectedCustomer?.name || 'Walk-in Customer',
          mobileNo: customerMobile || selectedCustomer?.mobileNo || '',
          stateCode: customerStateCode || null,
          details: lineItems.map((item) => ({
            productId: item.productId,
            product: item.product,
            qnty: item.qnty,
            salePrice: item.salePrice,
            sgstRate: item.sgstRate,
            cgstRate: item.cgstRate,
            discount: item.discount,
            returnQnty: item.returnQnty,
            returnDate: item.returnDate,
            amount: item.amount,
            discountAmount: item.discountAmount,
            sgstAmount: item.sgstAmount,
            cgstAmount: item.cgstAmount,
            totalAmount: item.totalAmount,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save sale')
      }

      const data = await response.json()
      const savedDetails = Array.isArray(data.saleDetails) ? data.saleDetails : []
      const mappedLines: SaleLineItem[] = savedDetails.map((d: SaleApiDetail) => ({
        id: String(d.saleDetailsId) || String(Math.random()).slice(2),
        saleDetailsId: d.saleDetailsId,
        productId: d.productId,
        product: d.product,
        description: d.productDescription || '',
        hsn: d.hsn || '',
        qnty: Number(d.qnty || 0),
        salePrice: Number(d.salePrice || 0),
        sgstRate: Number(d.sgstRate || 0),
        cgstRate: Number(d.cgstRate || 0),
        igstRate: Number(d.igstRate || 0),
        discount: Number(d.discount || 0),
        returnQnty: Number(d.returnQnty || 0),
        returnDate: d.returnDate ? String(d.returnDate).slice(0,10) : undefined,
        amount: Number(d.amount || 0),
        discountAmount: Number(d.discountAmount || 0),
        sgstAmount: Number(d.sgstAmount || 0),
        cgstAmount: Number(d.cgstAmount || 0),
        igstAmount: Number(d.igstAmount || 0),
        totalAmount: Number(d.totalAmount || 0),
      }))

      setSaleId(data.saleId || saleId)
      setBillNumber(data.billNumber || billNumber)
      if (mappedLines.length > 0) setLineItems(mappedLines)
      setUnsavedChanges(false)
      
      showSuccess('Saved', data.billNumber || 'Sale saved')
      
      // Clear form after successful save
      resetSaleForm()

      return data
    } catch (error) {
      console.error('Error saving sale:', error)
      showWarn('Error', error instanceof Error ? error.message : 'Failed to save sale')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCurrent = async () => {
    if (saleId) {
      const ok = confirm('Delete this sale? This will restore stock.')
      if (!ok) return
      await modalDeleteSale(saleId)
      resetSaleForm()
      return
    }

    if (lineItems.length === 0 && !customerSearch && !customerMobile && !billNumber) return
    const ok = confirm('Clear current bill?')
    if (!ok) return
    resetSaleForm()
  }

  const handlePrint = async () => {
    let currentSaleId = saleId
    if (!currentSaleId) {
      const saved = await handleSave()
      currentSaleId = saved?.saleId || saleId
      if (!currentSaleId) return
    }

    const result = await generateInvoicePDF()
    if (!result) return
    const win = window.open(result.url, '_blank')
    if (win) {
      try { win.focus(); win.print() } catch {}
    }
  }

  const handleSaveRef = useRef(handleSave)
  const handleDeleteRef = useRef(handleDeleteCurrent)
  const handlePrintRef = useRef(handlePrint)
  handleSaveRef.current = handleSave
  handleDeleteRef.current = handleDeleteCurrent
  handlePrintRef.current = handlePrint

  useEffect(() => {
    const onSave = () => {
      void handleSaveRef.current()
    }
    const onDelete = () => {
      void handleDeleteRef.current()
    }
    const onPrint = () => {
      void handlePrintRef.current()
    }

    window.addEventListener("inventoryPosSales:save", onSave)
    window.addEventListener("inventoryPosSales:delete", onDelete)
    window.addEventListener("inventoryPosSales:print", onPrint)

    return () => {
      window.removeEventListener("inventoryPosSales:save", onSave)
      window.removeEventListener("inventoryPosSales:delete", onDelete)
      window.removeEventListener("inventoryPosSales:print", onPrint)
    }
  }, [])

  const searchSales = async (_forceAll = false) => {
    setShowSearchModal(true)
    setIsSearching(true)
    try {
      // always fetch all so suffix / partial bill numbers work client-side
      const res = await fetch('/api/sales', { next: { revalidate: 60 } })
      const data = await res.json()
      const rows = Array.isArray(data) ? data : []
      const sorted = [...rows].sort((a: SaleApiRecord, b: SaleApiRecord) => {
        const ad = new Date(a.billDate || a.createdAt || 0).getTime()
        const bd = new Date(b.billDate || b.createdAt || 0).getTime()
        if (ad === bd) return (b.saleId || 0) - (a.saleId || 0)
        return bd - ad
      })
      setSearchResults(sorted)
      setSearchHighlight(0)
      return sorted
    } catch (err) {
      console.error('[SEARCH_SALES]', err)
      showWarn('Error', 'Failed to search bills')
      return []
    } finally {
      setIsSearching(false)
    }
  }

  const loadSale = (sale: SaleApiRecord) => {
    if (!sale) return
    setSaleId(sale.saleId || null)
    setBillNumber(sale.billNumber || '')
    setBillDate(formatDateDDMMYY(sale.billDate))
    setCustomerSearch(sale.customer || '')
    setCustomerMobile(sale.mobileNo || '')
    setCustomerStateCode(String(sale.stateCode || ''))
    setCustomerStateName(String(sale.stateName || sale.stateCode || ''))
    setIsHeaderPrepared(true)
    setSelectedCustomer(null)
    setDeletedDetailIds([])
    setStockWarnings({})

    const details = Array.isArray(sale.saleDetails) ? sale.saleDetails : []
    const mapped = details.map((d: SaleApiDetail) => {
      const { amount, discountAmount, sgstAmount, cgstAmount, igstAmount, totalAmount } = calculateLineTotal(
        Number(d.qnty || 0),
        Number(d.salePrice || 0),
        Number(d.discount || 0),
        Number(d.sgstRate || 0),
        Number(d.cgstRate || 0),
        Number(d.igstRate || 0),
      )
      return {
        id: String(d.saleDetailsId) || String(Math.random()),
        saleDetailsId: d.saleDetailsId,
        productId: d.productId,
        product: d.product,
        description: d.productDescription || '',
        hsn: d.hsn || '',
        qnty: Number(d.qnty || 0),
        salePrice: Number(d.salePrice || 0),
        sgstRate: Number(d.sgstRate || 0),
        cgstRate: Number(d.cgstRate || 0),
        igstRate: Number(d.igstRate || 0),
        discount: Number(d.discount || 0),
        returnQnty: Number(d.returnQnty || 0),
        returnDate: d.returnDate ? String(d.returnDate).slice(0, 10) : undefined,
        amount,
        discountAmount,
        sgstAmount,
        cgstAmount,
        igstAmount,
        totalAmount,
      }
    })
    setLineItems(mapped)
    setUnsavedChanges(false)
    setShowSearchModal(false)
    showSuccess('Loaded', sale.billNumber || 'Sale loaded')
  }

  const modalStartEdit = (sale: SaleApiRecord) => {
    setModalEditingSale(sale)
    const details = Array.isArray(sale.saleDetails) ? sale.saleDetails : []
    const mapped = details.map((d: SaleApiDetail) => ({
      id: String(d.saleDetailsId) || String(Date.now()) + Math.random(),
      productId: d.productId,
      product: d.product,
      description: d.productDescription || '',
      hsn: d.hsn || '',
      qnty: Number(d.qnty || 0),
      salePrice: Number(d.salePrice || 0),
      sgstRate: Number(d.sgstRate || 0),
      cgstRate: Number(d.cgstRate || 0),
      igstRate: Number(d.igstRate || 0),
      discount: Number(d.discount || 0),
      returnQnty: Number(d.returnQnty || 0),
      returnDate: d.returnDate ? String(d.returnDate).slice(0,10) : undefined,
      amount: Number(d.amount || 0),
      discountAmount: Number(d.discountAmount || 0),
      sgstAmount: Number(d.sgstAmount || 0),
      cgstAmount: Number(d.cgstAmount || 0),
      igstAmount: Number(d.igstAmount || 0),
      totalAmount: Number(d.totalAmount || 0),
    }))
    setModalEditingLines(mapped)
  }

  const updateModalLine = (id: string, updates: Partial<SaleLineItem>) => {
    setModalEditingLines((lines) =>
      lines.map((ln) => {
        if (ln.id !== id) return ln
        const updated = { ...ln, ...updates }
        const { amount, discountAmount, sgstAmount, cgstAmount, igstAmount, totalAmount } = calculateLineTotal(
          updated.qnty,
          updated.salePrice,
          updated.discount,
          updated.sgstRate || 0,
          updated.cgstRate || 0,
          updated.igstRate || 0,
        )
        return { ...updated, amount, discountAmount, sgstAmount, cgstAmount, igstAmount, totalAmount }
      })
    )
  }

  const modalSaveEdit = async () => {
    if (!modalEditingSale) return
    if (modalEditingLines.length === 0) {
      showWarn('Validation', 'Please add at least one product')
      return
    }
    setModalSaving(true)
    try {
      const url = `/api/sales/${modalEditingSale.saleId}`
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billNumber: modalEditingSale.billNumber,
          billDate: modalEditingSale.billDate,
          customer: modalEditingSale.customer,
          mobileNo: modalEditingSale.mobileNo,
          details: modalEditingLines.map((l) => ({
            productId: l.productId,
            product: l.product,
            qnty: l.qnty,
            salePrice: l.salePrice,
            sgstRate: l.sgstRate,
            cgstRate: l.cgstRate,
            discount: l.discount,
            returnQnty: l.returnQnty,
            returnDate: l.returnDate,
          })),
        }),
      })
      if (res.ok) {
        showSuccess('Success', 'Sale updated')
        setModalEditingSale(null)
        setModalEditingLines([])
        setShowSearchModal(false)
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }
    } catch (err) {
      console.error('[MODAL_SAVE]', err)
      showWarn('Error', err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setModalSaving(false)
    }
  }

  const modalDeleteSale = async (saleIdToDelete?: number) => {
    const id = saleIdToDelete || modalEditingSale?.saleId
    if (!id) return
    if (!confirm('Delete this sale? This will restore stock.')) return
    try {
      const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccess('Deleted', 'Sale deleted')
        setModalEditingSale(null)
        setModalEditingLines([])
        setShowSearchModal(false)
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
    } catch (err) {
      console.error('[MODAL_DELETE]', err)
      showWarn('Error', err instanceof Error ? err.message : 'Failed to delete')
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

  // Generate professional PDF invoice using jsPDF
  const generateInvoicePDF = async (salePayload?: SaleApiRecord) => {
    // prefer to use saved sale (saleId) or passed payload
    let fetchedSaleData: SaleApiRecord | null = null
    if (!salePayload && saleId) {
      const response = await fetch(`/api/sales?id=${saleId}`, { next: { revalidate: 60 } })
      let body: unknown = null
      try {
        body = await response.json()
      } catch {
        body = null
      }

      if (!response.ok) {
        const errorMsg = typeof (body as Record<string, unknown>)?.error === 'string' ? (body as Record<string, unknown>).error : "Failed to load sale details for invoice"
        throw new Error(String(errorMsg))
      }

      fetchedSaleData = body as SaleApiRecord
    }

    const saleData = salePayload || fetchedSaleData
    if (!saleData) {
      showWarn('No Data', 'Save the bill first to generate invoice')
      return null
    }

    // build invoice details
    const { saleDetails = [], billNumber: bn, billDate: bd, customer: cust, mobileNo } = saleData
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })

    // Header
    doc.setFontSize(14)
    doc.text('Company Name', 40, 50)
    doc.setFontSize(10)
    doc.text('Address line 1, City - PIN', 40, 66)
    doc.text('GST: 00AAAAA0000Z0', 40, 80)
    doc.text(`Invoice: ${bn || ''}`, 420, 50)
    doc.text(`Date: ${String(bd || '').slice(0,10)}`, 420, 66)
    doc.text(`Customer: ${cust || ''}`, 40, 100)
    doc.text(`Mobile: ${mobileNo || ''}`, 40, 116)

    // Items table
    const tableBody = (saleDetails || []).map((d: SaleApiDetail, i: number) => {
      return [
        String(i + 1),
        d.product || '',
        d.hsn || '',
        Number(d.qnty || 0).toFixed(2),
        Number(d.salePrice || 0).toFixed(2),
        Number(d.discountAmount || 0).toFixed(2),
        Number(d.igstAmount || 0).toFixed(2),
        Number(d.totalAmount || 0).toFixed(2),
      ]
    })

    autoTable(doc, {
      startY: 140,
      head: [[ 'Sl No','Item','HSN','Qty','Rate','Discount','IGST','Total' ]],
      body: tableBody,
      styles: { fontSize: 9 }
    })

    const finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 300
    // Totals
    doc.setFontSize(10)
    const subtotal = Number(totals.amount || 0)
    const totalDiscount = Number(totals.discount || 0)
    const cgstTotal = Number(totals.cgst || 0)
    const sgstTotal = Number(totals.sgst || 0)
    const igstTotal = Number(totals.igst || 0)
    const grand = Number(totals.total || 0)

    doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, 380, finalY + 30)
    doc.text(`Discount: ₹${totalDiscount.toFixed(2)}`, 380, finalY + 46)
    doc.text(`CGST: ₹${cgstTotal.toFixed(2)}`, 380, finalY + 62)
    doc.text(`SGST: ₹${sgstTotal.toFixed(2)}`, 380, finalY + 78)
    doc.text(`IGST: ₹${igstTotal.toFixed(2)}`, 380, finalY + 94)
    doc.setFontSize(12)
    doc.text(`Grand Total: ₹${grand.toFixed(2)}`, 380, finalY + 118)

    // Footer
    doc.setFontSize(9)
    doc.text('Payment Mode: Cash / Card / UPI', 40, finalY + 160)
    doc.text('Thank you for your business!', 40, finalY + 182)

    const pdfBlob = doc.output('blob')
    const url = URL.createObjectURL(pdfBlob)
    window.open(url, '_blank')
    return { blob: pdfBlob, url }
  }

  const searchFilterTerm = searchBillQuery.trim().toLowerCase()
  const saleMatchesSearch = (r: SaleApiRecord, term: string) => {
    const bill = String(r.billNumber || '').toLowerCase()
    const customer = String(r.customer || '').toLowerCase()
    return term ? bill.includes(term) || customer.includes(term) : true
  }
  const filteredResults = searchResults.filter((r) => saleMatchesSearch(r, searchFilterTerm))

  const saleBillFiltered = useMemo(() => {
    const q = saleBillInput.trim().toLowerCase()
    if (!q) return saleBillAllResults.slice(0, 50)
    return saleBillAllResults.filter((r) =>
      String(r.billNumber || '').toLowerCase().includes(q) ||
      String(r.customer || '').toLowerCase().includes(q)
    )
  }, [saleBillInput, saleBillAllResults])

  const openSaleBillSearch = async () => {
    setIsSaleBillOpen(true)
    if (saleBillAllResults.length === 0) {
      setIsSaleBillLoading(true)
      try {
        const res = await fetch('/api/sales', { next: { revalidate: 60 } })
        const data = await res.json()
        const rows = Array.isArray(data) ? data : []
        const sorted = [...rows].sort((a: SaleApiRecord, b: SaleApiRecord) => {
          const ad = new Date(a.billDate || a.createdAt || 0).getTime()
          const bd = new Date(b.billDate || b.createdAt || 0).getTime()
          if (ad === bd) return (b.saleId || 0) - (a.saleId || 0)
          return bd - ad
        })
        setSaleBillAllResults(sorted)
      } catch {
        setSaleBillAllResults([])
      } finally {
        setIsSaleBillLoading(false)
      }
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-transparent p-0 shadow-none">
        <CardContent className="space-y-6 p-0">
          {/* Product Search & Grid */}
          <div className="space-y-4">
            {/* Warning for stock issues (visual only) - banner removed per request */}

            {/* Product selection: click the Item Name cell to open product picker (from latest purchase). */}

            {/* Line Items Table */}
            {!isHeaderPrepared ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Add bill header details first. After saving header and customer state, the sale detail row will appear.
              </div>
            ) : (
            <div ref={tableContainerRef} className="inventory-pos-table-wrapper inventory-pos-sales-table-wrapper">
              <Table className="w-full table-fixed">
              {/* picker moved outside table to keep valid HTML structure */}
                  <TableHeader className="bg-gray-100 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12">Sl No</TableHead>
                      <TableHead style={{ width: '40%' }} className="text-left">Item Name</TableHead>
                      <TableHead style={{ width: '15%' }}>HSN</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-[7.2rem]">Rate</TableHead>
                      <TableHead className="w-24">Discount</TableHead>
                      <TableHead className="w-24">IGST (%)</TableHead>
                      <TableHead className="w-[8.4rem]">Line Total</TableHead>
                      <TableHead className="w-16">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, idx) => (
                      <TableRow key={item.id} className={stockWarnings[item.id] ? 'bg-red-50' : ''}>
                        <TableCell className="text-center">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <select
                              name={`product-${item.id}`}
                              value={item.product ?? ''}
                              onMouseDown={(e) => {
                                if (!ensureSaleRowAccess()) {
                                  e.preventDefault()
                                }
                              }}
                              onFocus={(e) => {
                                if (!ensureSaleRowAccess()) {
                                  try { (e.target as HTMLElement).blur() } catch {}
                                }
                              }}
                              onChange={(e) => {
                                ensurePurchaseProducts()
                                const name = e.target.value || ''
                                const prod = purchaseProducts.find((p) => String(p.productName || '') === name)
                                if (prod) selectProduct(prod, item.id)
                              }}
                              className="h-8 w-full rounded-md border px-0.5 flex-1"
                            >
                              <option value="">Select product</option>
                              {Array.from(new Map(purchaseProducts.map(p => [String(p.productName || ''), p])).values()).map((p) => (
                                <option key={p.productId} value={p.productName}>{p.productName}</option>
                              ))}
                            </select>
                            <button type="button" title="View products" onClick={() => openProductModal(item.id, String(item.product || ''))} className="p-1">
                              <Eye className="h-5 w-5 text-gray-600" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input readOnly value={item.hsn || ''} className="h-8 w-full bg-gray-50 px-0.5 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.qnty}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0
                              updateLineItem(item.id, { qnty: v })
                              try {
                                const res = checkStockWarning(item.productId, v, item.id)
                                const isWarn = !!res && res.isWarning
                                const available = res && res.available
                                if (isWarn && !stockToastShownRef.current[item.id]) {
                                  const prod = products.find((p) => p.productId === item.productId) || purchaseProducts.find((p) => p.productId === item.productId)
                                  const name = prod ? (prod.productName || prod.product || '') : (item.product || '')
                                  const availText = typeof available === 'number' ? ` (available ${available})` : ''
                                  showWarn('Stock Alert', `${name}: entered ${v}${availText}`)
                                  stockToastShownRef.current[item.id] = true
                                }
                                if (!isWarn) stockToastShownRef.current[item.id] = false
                              } catch {}
                            }}
                            ref={(el: HTMLInputElement | null) => { qtyInputRefs.current[item.id] = el }}
                            onBlur={(e) => {
                              const entered = Number((e.target as HTMLInputElement).value) || 0
                              try {
                                const res = checkStockWarning(item.productId, entered, item.id)
                                const isWarn = !!res && res.isWarning
                                const available = res && res.available
                                if (isWarn) {
                                  const prod = products.find((p) => p.productId === item.productId) || purchaseProducts.find((p) => p.productId === item.productId)
                                  const name = prod ? (prod.productName || prod.product || '') : (item.product || '')
                                  const availText = typeof available === 'number' ? ` (available ${available})` : ''
                                  showWarn('Stock Alert', `${name}: entered ${entered}${availText}`)
                                  // keep focus in this qty input until user fixes qty
                                  setTimeout(() => { try { qtyInputRefs.current[item.id]?.focus() } catch {} }, 10)
                                }
                              } catch {}
                            }}
                            className={`h-8 w-full px-0.5 ${stockWarnings[item.id] ? 'border-red-500' : ''}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.salePrice}
                            readOnly
                            className="h-7 w-full bg-gray-50 px-0.5"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={Number(item.discountAmount || 0)}
                            onChange={(e) => {
                              const entered = Number(e.target.value) || 0
                              const base = (item.qnty || 0) * (item.salePrice || 0)
                              const pct = base > 0 ? (entered / base) * 100 : 0
                              updateLineItem(item.id, { discount: pct })
                            }}
                            className="h-8 w-full px-0.5"
                          />
                        </TableCell>
                        <TableCell>
                          <Input readOnly value={`${Number(item.igstRate || 0).toFixed(2)} %`} className="h-8 w-full px-0.5 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input readOnly value={item.totalAmount.toFixed(2)} className="h-8 w-full px-0.5 font-semibold text-right" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(item.id)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              aria-label="Delete line item"
                              title="Delete item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Add-new row always present */}
                    <TableRow>
                      <TableCell className="text-center">{lineItems.length + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                              <select
                                name="newProduct"
                                value={''}
                                onFocus={() => {
                                  if (!ensureSaleRowAccess()) return
                                  ensurePurchaseProducts()
                                }}
                                onChange={(e) => {
                              if (!ensureSaleRowAccess()) return
                              ensurePurchaseProducts()
                              const name = e.target.value || ''
                              const prod = purchaseProducts.find((p) => String(p.productName || '') === name)
                              if (prod) selectProduct(prod, 'new')
                            }}
                            className="h-8 w-full rounded-md border px-0.5 flex-1"
                          >
                            <option value="">Select product</option>
                            {Array.from(new Map(purchaseProducts.map(p => [String(p.productName || ''), p])).values()).map((p) => (
                              <option key={p.productId} value={p.productName}>{p.productName}</option>
                            ))}
                          </select>
                          <button type="button" title="View products" onClick={() => openProductModal('new', '')} className="p-1">
                            <Eye className="h-5 w-5 text-gray-600" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input readOnly value="" className="h-8 w-full px-0.5" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={newRowDefaults.qnty} onChange={(e) => setNewRowDefaults(prev => ({ ...prev, qnty: Number(e.target.value) || 1 }))} className="h-8 w-full px-0.5" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={0} readOnly className="h-7 w-full px-0.5" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={newRowDefaults.discountAmount} onChange={(e) => setNewRowDefaults(prev => ({ ...prev, discountAmount: Number(e.target.value) || 0 }))} className="h-8 w-full px-0.5" />
                      </TableCell>
                      <TableCell>
                        <Input readOnly value={`${0} %`} className="h-8 w-full px-0.5 text-right" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={0} readOnly className="h-8 w-full px-0.5 font-semibold text-right" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Button variant="ghost" size="sm" disabled className="h-8 text-muted-foreground">-</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {pickerState.open && (() => {
                  const filtered = purchaseProducts.filter((pp) => String(pp.productName || '').toLowerCase().includes(String(pickerFilter || '').toLowerCase()))
                  return (
                    <div
                      ref={pickerRef}
                      style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, width: pickerPos.width || 320, zIndex: 9999, maxHeight: 240, overflowY: 'auto' }}
                      className="rounded-md border bg-popover shadow-md"
                    >
                      {filtered.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-muted-foreground">No products in latest purchase</div>
                      ) : (
                        filtered.map((p, i) => (
                          <div
                            key={p.productId + '-' + i}
                            className={`cursor-pointer px-4 py-2 ${pickerState.highlight === i ? 'bg-accent text-white' : 'hover:bg-accent'}`}
                            onClick={() => selectProduct(p, pickerState.anchorId)}
                          >
                            <div className="font-medium">{p.productName}</div>
                            <div className="text-xs text-muted-foreground">Purchase: ₹{Number(p.purchasePrice || 0).toFixed(2)} | Sale: ₹{Number(p.salePrice || 0).toFixed(2)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )
                })()}
                {/* Product modal: view list with prices and keyboard navigation */}
                {productModalOpen && (() => {
                  const filteredModal = purchaseProducts.filter((pp) => String(pp.productName || '').toLowerCase().includes(String(productModalFilter || '').toLowerCase()))
                  return (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
                      <div className="absolute inset-0 bg-black/30" onClick={() => setProductModalOpen(false)} />
                      <div ref={productModalRef} className="relative z-60 w-[min(540px,56%)] max-h-[70vh] overflow-auto rounded-md bg-white p-3 shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            id="product-modal-filter"
                            name="productModalFilter"
                            autoFocus
                            value={productModalFilter}
                            onChange={(e) => { setProductModalFilter(e.target.value); setProductModalHighlight(0) }}
                            placeholder="Filter products..."
                            className="h-9 w-full rounded border px-2"
                          />
                          <button type="button" onClick={() => setProductModalOpen(false)} className="ml-2 p-2 rounded border text-gray-600" aria-label="Close modal"><X className="h-4 w-4" /></button>
                        </div>

                        <div className="overflow-hidden">
                          <Table className="w-full table-auto">
                            <TableHeader className="bg-gray-100">
                              <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">MRP</TableHead>
                                <TableHead className="text-right">Sale Price</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredModal.length === 0 ? (
                                <TableRow><TableCell colSpan={3} className="px-2 py-3 text-sm text-muted">No products found</TableCell></TableRow>
                              ) : (
                                filteredModal.map((p, i) => (
                                  <TableRow
                                    key={p.productId + '-' + i}
                                    ref={el => { productRowRefs.current[i] = el }}
                                    onClick={() => { selectProduct(p, productModalAnchor); setProductModalOpen(false); }}
                                    className={`${productModalHighlight === i ? 'bg-accent text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                                    tabIndex={0}
                                  >
                                    <TableCell className="align-top text-gray-700">{p.productName || ''}</TableCell>
                                    <TableCell className="text-right align-top text-gray-700">₹{Number(p.salePrice || 0).toFixed(2)}</TableCell>
                                    <TableCell className="text-right align-top text-gray-700">₹{Number(p.purchasePrice || 0).toFixed(2)}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

            <div className="shrink-0 mt-4">
              <Button
                type="button"
                variant="ghost"
                className="global-bottom-btn-add"
                onClick={() => {
                  if (isHeaderPrepared) {
                    addEmptyLineItem()
                    return
                  }
                  startFreshBill()
                }}
                disabled={isLoading}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> {isHeaderPrepared ? 'Add Product' : 'Add Bill'}
              </Button>
            </div>

            {/* Totals Summary */}
            {lineItems.length > 0 && (
              <div className="ml-auto w-96 space-y-2 rounded-md border bg-blue-50 p-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">₹{totals.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span className="text-red-600">-₹{totals.discount.toFixed(2)}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div />
                </div>
                <div className="flex gap-2 mt-2" />
              </div>
            )}

            <Dialog open={isAddBillModalOpen} onOpenChange={setIsAddBillModalOpen}>
              <DialogContent className="max-w-[46rem]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-semibold">Add Bill</DialogTitle>
                </DialogHeader>

                <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="sales-bill-customer">Customer Name</Label>
                      <div className="relative">
                        <Input
                          id="sales-bill-customer"
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value)
                            setSelectedCustomer(null)
                            setCustomerStateCode('')
                            setCustomerStateName('')
                            setShowCustomerSuggestions(true)
                          }}
                          onFocus={() => setShowCustomerSuggestions(true)}
                          onClick={() => setShowCustomerSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 100)}
                          placeholder="Search customer"
                          className="h-10 global-record-search-input"
                          autoComplete="off"
                        />
                        {showCustomerSuggestions && (
                          <div className="dropdown-container">
                            <div className="dropdown-scroll dropdown-scroll-modal">
                              {Array.isArray(customers) && customers.length > 0 ? (
                                customers
                                  .filter((c) => ((c.customerName || c.name || '') as string).toLowerCase().includes(String(customerSearch).toLowerCase()))
                                  .slice(0, 8)
                                  .map((c: CustomerOption) => (
                                    <button
                                      key={c.customerId || c.id || (c.mobileNo || c.mobile)}
                                      type="button"
                                      onMouseDown={() => {
                                        const name = c.customerName || c.name || ''
                                        const mobile = c.mobileNo || c.mobile || ''
                                        setSelectedCustomer(c)
                                        setCustomerSearch(name)
                                        setCustomerMobile(mobile)
                                        setCustomerStateCode(String(c.stateId || ''))
                                        setCustomerStateName(String(c.state || ''))
                                        setShowCustomerSuggestions(false)
                                        setUnsavedChanges(true)
                                      }}
                                      className="dropdown-item"
                                    >
                                      {(c.customerName || c.name)} - {(c.mobileNo || c.mobile || '')}
                                    </button>
                                  ))
                              ) : (
                                <div className="dropdown-empty-state">No customers found.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sales-bill-mobile">Mobile</Label>
                      <Input
                        id="sales-bill-mobile"
                        value={customerMobile}
                        onChange={(e) => {
                          const digits = (e.target.value || '').replace(/\D/g, '').slice(0, 10)
                          setCustomerMobile(digits)
                          setSelectedCustomer(null)
                          setUnsavedChanges(true)
                        }}
                        placeholder="10-digit mobile"
                        className="h-10"
                        ref={mobileInputRef}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sales-bill-date">Bill Date</Label>
                      <DatePickerInput
                        id="sales-bill-date"
                        value={billDate}
                        onChange={(value) => {
                          setBillDate(value)
                          setUnsavedChanges(true)
                        }}
                        className="h-10"
                        format="dd-mm-yy"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddBillModalOpen(false)
                        setPendingHeaderSave(false)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={prepareBillHeader}>
                      Save Header
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <CustomerStateModal
              open={showCustomerStateModal}
              onOpenChange={setShowCustomerStateModal}
              customerName={customerSearch || 'Customer'}
              currentStateId={customerStateCode}
              currentStateName={customerStateName}
              mandatory
              onSave={handleSaveCustomerState}
            />
        </CardContent>
      </Card>
    </div>
  )
}

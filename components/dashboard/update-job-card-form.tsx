"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { notify } from '@/components/ui/notify'
import { startAction, successAction, errorAction } from "@/lib/action-feedback"
import { JOB_CARD_STATUSES, MAINTENANCE_TYPES } from "@/lib/constants"
import useContinuousRows from '@/components/hooks/useContinuousRows'
import { FinancialTransactionData } from "./financial-transaction-modal"
import DatePickerInput from "@/components/ui/date-picker-input"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"
import { SparePartsTable } from "./update-job-card/spare-parts-table"
import { SparePartReturnTable } from "./update-job-card/spare-part-return-table"
import { ServiceDescriptionTable } from "./update-job-card/service-description-table"
import { TechnicianAllocationTable } from "./update-job-card/technician-allocation-table"
import { FinancialTransactionsTable } from "./update-job-card/financial-transactions-table"
import { CustomerStateForm } from "./update-job-card/CustomerStateForm"
import type {
  FinancialTransactionRow,
  ServiceRow,
  SparePartReturnRow,
  SparePartRow,
  TechnicianRow,
} from "./update-job-card/types"

interface UpdateFormData {
  jobCardId: string
  customerId: string
  vehicleId: string
  fileNo: string
  mobileNo: string
  registrationNumber: string
  customerName: string
  vehicleModel: string
  jobcardDate: string
  jobcardStatus: string
  deliveryStatus: string
  deliveryDate?: string
  maintenanceType: string
  odo: string
  total: number
  discount: number
  totalBill: number
  advance: number
  advancePayment: number
  balance: number
  paid: number
  jobcardPaymentStatus?: string
  taxable?: boolean
  externalShop?: boolean
  externalShopRemarks?: string
}

interface RegistrationSuggestion {
  id: string
  fileNo: string
  mobileNo: string
  registrationNumber: string
  customerName: string
  jobCardNumber: string
   vehicleMake?: string
   vehicleModel?: string
}

const DELIVERY_STATUSES = ["Pending", "Ready", "Delivered"] as const
const generateRowId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const createSparePartRow = (jobcardDate?: string): SparePartRow => ({
  id: generateRowId(),
  shopName: "",
  billDate: formatDateDDMMYY(jobcardDate || new Date()),
  billNumber: "",
  item: "",
  amount: 0,
  paid: 0,
  paidDate: "",
  isReturn: false,
  returnDate: "",
  returnAmount: 0,
})

const createSparePartReturnRow = (): SparePartReturnRow => ({
  id: generateRowId(),
  billNumber: "",
  returnedItem: "",
  returnDate: "",
  returnAmount: 0,
})

const createServiceRow = (): ServiceRow => ({
  id: generateRowId(),
  description: "",
  unit: "",
  quantity: 0,
  amount: 0,
  cgstRate: 0,
  cgstAmount: 0,
  sgstRate: 0,
  sgstAmount: 0,
  igstRate: 0,
  igstAmount: 0,
  totalAmount: 0,
  stateId: "",
})

const createTechnicianRow = (): TechnicianRow => ({
  id: generateRowId(),
  employeeName: "",
  taskAssigned: "",
  allocationAmount: 0,
})

const createFinancialTransactionRow = (): FinancialTransactionRow => ({
  id: generateRowId(),
  transactionType: "",
  transactionDate: formatDateDDMMYY(new Date()),
  paymentType: "",
  applyTo: "",
  transactionAmount: 0,
  description: "",
})

const isSparePartRowTouched = (row: SparePartRow) =>
  Boolean(
    row.shopName.trim() ||
      row.billNumber.trim() ||
      row.item.trim() ||
      Number(row.amount || 0) > 0 ||
      row.billDate ||
      Boolean(row.paid) ||
      (row.paidDate || "").trim()
  )

const isSparePartReturnRowTouched = (row: SparePartReturnRow) =>
  Boolean(
    row.billNumber.trim() ||
      row.returnedItem.trim() ||
      row.returnDate.trim() ||
      Number(row.returnAmount || 0) > 0
  )

const isServiceRowTouched = (row: ServiceRow) =>
  Boolean(
    row.description.trim() ||
      row.unit.trim() ||
      Number(row.quantity || 0) > 0 ||
      Number(row.amount || 0) > 0 ||
      Number(row.cgstRate || 0) > 0 ||
      Number(row.sgstRate || 0) > 0 ||
      Number(row.igstRate || 0) > 0 ||
      Number(row.cgstAmount || 0) > 0 ||
      Number(row.sgstAmount || 0) > 0 ||
      Number(row.igstAmount || 0) > 0
  )

const isTechnicianRowTouched = (row: TechnicianRow) =>
  Boolean(
    row.employeeName.trim() ||
      row.taskAssigned.trim() ||
      Number(row.allocationAmount || 0) > 0
  )

const formatDateInput = (value?: string | Date | null) => {
  if (!value) {
    return ""
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return formatDateDDMMYY(date)
}

const formatDateDDMMYY = (value?: string | Date | null) => {
  if (!value) {
    return ""
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = String(date.getFullYear()).slice(-2)

  return `${day}-${month}-${year}`
}

const parseDDMMYYToISO = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const [, dd, mm, yy] = match
  const day = Number(dd)
  const month = Number(mm)
  const year = 2000 + Number(yy)

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

const normalizeApplyTo = (value?: string) => (value || "").trim().toLowerCase()

const derivePaymentStatus = (
  totalBill: number,
  paidAmount: number,
  advanceAmount: number
): "Pending" | "Partial" | "Completed" => {
  const totalCollected = Math.max(paidAmount, 0) + Math.max(advanceAmount, 0)
  const safeTotalBill = Math.max(totalBill, 0)

  if (safeTotalBill > 0 && totalCollected >= safeTotalBill) {
    return "Completed"
  }

  if (totalCollected > 0) {
    return "Partial"
  }

  return "Pending"
}

const emptyForm: UpdateFormData = {
  jobCardId: "",
  customerId: "",
  vehicleId: "",
  fileNo: "",
  mobileNo: "",
  registrationNumber: "",
  customerName: "",
  vehicleModel: "",
  jobcardDate: formatDateDDMMYY(new Date()),
  jobcardStatus: "Under Service",
  deliveryStatus: "Pending",
  deliveryDate: "",
  maintenanceType: "General Maint.",
  odo: "",
  total: 0,
  discount: 0,
  totalBill: 0,
  advance: 0,
  advancePayment: 0,
  balance: 0,
  paid: 0,
  jobcardPaymentStatus: "Pending",
  taxable: false,
  externalShop: false,
  externalShopRemarks: "",
}

interface UpdateJobCardFormProps {
  activeSubform?: "main-form" | "spare-parts-purchase" | "spare-part-return" | "service-description" | "technician-allocation" | "financial-transactions"
  selectedJobCardId?: string
  searchInputRef?: React.RefObject<HTMLInputElement | null>
  searchValue?: string
  onSearchChange?: (value: string) => void
  onJobCardLoaded?: (jobCardId: string) => void
  onJobCardDeleted?: (jobCardId: string) => void
}

export function UpdateJobCardForm({
  activeSubform = "main-form",
  selectedJobCardId,
  searchInputRef,
  searchValue,
  onSearchChange,
  onJobCardLoaded,
  onJobCardDeleted,
}: UpdateJobCardFormProps) {
  const [formData, setFormData] = useState<UpdateFormData>(emptyForm)
  // Start with no empty rows; users must click Add to create rows.
  const { rows: spareParts, updateRow: updateSparePartRow, addRow: addSparePartRow, removeRow: removeSparePartRow, setRows: setSpareParts } = useContinuousRows<SparePartRow>(() => createSparePartRow(formData.jobcardDate), [], { autoAppend: false })
  const { rows: sparePartReturns, updateRow: updateSparePartReturnRow, addRow: addSparePartReturnRow, removeRow: removeSparePartReturnRow, setRows: setSparePartReturns } = useContinuousRows<SparePartReturnRow>(() => createSparePartReturnRow(), [], { autoAppend: false })
  const { rows: services, updateRow: updateServiceRow, addRow: addServiceRow, removeRow: removeServiceRow, setRows: setServices } = useContinuousRows<ServiceRow>(() => createServiceRow(), [], { autoAppend: false })
  const { rows: technicians, updateRow: updateTechnicianRow, addRow: addTechnicianRow, removeRow: removeTechnicianRow, setRows: setTechnicians } = useContinuousRows<TechnicianRow>(() => createTechnicianRow(), [], { autoAppend: false })
  const { rows: financialTransactions, updateRow: updateFinancialTransactionRow, addRow: addFinancialTransactionRow, removeRow: removeFinancialTransactionRow, setRows: setFinancialTransactions } = useContinuousRows<FinancialTransactionRow>(() => createFinancialTransactionRow(), [], { autoAppend: false })
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingRecord, setIsLoadingRecord] = useState(false)
  const [suppressAutoReload, setSuppressAutoReload] = useState(false)
  const [isSelectingSuggestion, setIsSelectingSuggestion] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [registrationSuggestions, setRegistrationSuggestions] = useState<RegistrationSuggestion[]>([])
  const [allVehicles, setAllVehicles] = useState<RegistrationSuggestion[]>([])
  const [showRegistrationSuggestions, setShowRegistrationSuggestions] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [customerStateId, setCustomerStateId] = useState<string>("")
  const [customerStateName, setCustomerStateName] = useState<string>("")
  const [shopStateId, setShopStateId] = useState<string>("")

  // Customer State Sub-form
  const [showCustomerStateForm, setShowCustomerStateForm] = useState(false)
  const [states, setStates] = useState<Array<{ stateId: string; stateName: string; stateCode?: string }>>([])
  const [selectedStateId, setSelectedStateId] = useState<string>("")
  const [isLoadingStates, setIsLoadingStates] = useState(false)

  // Technician allocation dropdown
  const [technicianOptions, setTechnicianOptions] = useState<Array<{ id: number; name: string }>>([])
  const [openTechnicianDropdownRowId, setOpenTechnicianDropdownRowId] = useState<string | null>(null)
  const [technicianDropdownPos, setTechnicianDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  const initialSnapshotRef = useRef<string>("")
  const suggestionDebounceRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const selectedSuggestionRef = useRef<RegistrationSuggestion | null>(null)
  const selectionLockRef = useRef(false)
  const deliveryStatusButtonRef = useRef<HTMLButtonElement | null>(null)
  const paymentStatusButtonRef = useRef<HTMLButtonElement | null>(null)
  const odoInputRef = useRef<HTMLInputElement | null>(null)
  const rejectedDeliveredRef = useRef<string>("")
  const failedLoadAttemptRef = useRef<Set<string>>(new Set())
  const internalRegistrationInputRef = useRef<HTMLInputElement | null>(null)
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null)
  const technicianDropdownContainerRef = useRef<HTMLDivElement | null>(null)
  const registrationInputRef = searchInputRef || internalRegistrationInputRef
  const sparePartRefsMap = useRef<Map<string, HTMLInputElement>>(new Map())
  const serviceRefsMap = useRef<Map<string, HTMLInputElement>>(new Map())
  const technicianRefsMap = useRef<Map<string, HTMLInputElement>>(new Map())
  const loadJobCardRef = useRef<(jobCardId?: string, opts?: { silent?: boolean }) => Promise<void>>(() => Promise.resolve())
  
  const dropdownNav = useDropdownKeyboardNav({
    itemCount: registrationSuggestions.length,
    isOpen: showRegistrationSuggestions,
    onSelect: (index) => {
      handleSelectRegistrationSuggestion(registrationSuggestions[index])
    },
    onClose: () => {
      setShowRegistrationSuggestions(false)
    },
  })
  
  const openDeliveryStatusDropdown = () => {
    if (deliveryStatusButtonRef.current) {
      deliveryStatusButtonRef.current.click()
    }
  }
  const openPaymentStatusDropdown = () => {
    if (paymentStatusButtonRef.current) {
      paymentStatusButtonRef.current.click()
    }
  }

  const fetchRegistrationSuggestions = useCallback(
    async (inputValue: string) => {
      // Filter allVehicles based on input
      const query = inputValue.trim().toUpperCase()
      
      if (!query) {
        // Show all vehicles if empty
        setRegistrationSuggestions(allVehicles)
      } else {
        // Filter by registration number or customer name
        setRegistrationSuggestions(
          allVehicles.filter(
            (v) =>
              v.registrationNumber.includes(query) ||
              v.customerName.toUpperCase().includes(query)
          )
        )
      }
      dropdownNav.resetHighlight()
    },
    [allVehicles, dropdownNav]
  )

  const handleRegistrationInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Don't allow input changes while selection is locked
      if (selectionLockRef.current) {
        return
      }
      
      const value = e.target.value.toUpperCase()

      setSuppressAutoReload(true)

      setFormData((prev) => ({
        ...prev,
        registrationNumber: value,
        jobCardId: "",
        customerId: "",
        vehicleId: "",
        customerName: "",
        vehicleModel: "",
      }))

      // Filter and show dropdown as user types
      fetchRegistrationSuggestions(value)
      setShowRegistrationSuggestions(true)
    },
    [fetchRegistrationSuggestions]
  )

  const handleSelectRegistrationSuggestion = useCallback(
    async (suggestion: RegistrationSuggestion) => {
      const selectedId = suggestion.id
      console.log("handleSelectRegistrationSuggestion called:", { selectedId, reg: suggestion.registrationNumber })
      
      // Check if already selecting
      if (selectionLockRef.current || isSelectingSuggestion) {
        console.log("Selection blocked - already selecting")
        return
      }
      
      // Lock the selection immediately
      selectionLockRef.current = true
      selectedSuggestionRef.current = suggestion
      
      // Immediately close dropdown and prevent all updates
      setShowRegistrationSuggestions(false)
      setIsLoadingSuggestions(false)
      setRegistrationSuggestions([])
      setIsSelectingSuggestion(true)
      setSuppressAutoReload(true)
      
      // Cancel any pending debounced fetches
      if (suggestionDebounceRef.current) {
        clearTimeout(suggestionDebounceRef.current)
      }
      
      const makeModel = [suggestion.vehicleMake, suggestion.vehicleModel]
        .filter(Boolean)
        .join(" ")

      setFormData((prev) => ({
        ...prev,
        fileNo: suggestion.fileNo,
        mobileNo: suggestion.mobileNo,
        registrationNumber: suggestion.registrationNumber,
        vehicleModel: makeModel || prev.vehicleModel,
        jobCardId: selectedId,
        customerId: "",
        vehicleId: "",
        customerName: "",
      }))

      try {
        await loadJobCardRef.current(selectedId)
      } catch (error) {
        console.error('Error loading job card:', error)
      } finally {
        setSuppressAutoReload(false)
        setIsSelectingSuggestion(false)
        selectionLockRef.current = false
        selectedSuggestionRef.current = null
      }
    },
    [isSelectingSuggestion]
  )

  useEffect(() => {
    console.debug("UpdateJobCardForm:prop selectedJobCardId", { selectedJobCardId })
  }, [selectedJobCardId])

  useEffect(() => {
    console.debug("UpdateJobCardForm:state jobCardId", { jobCardId: formData.jobCardId })
  }, [formData.jobCardId])

  // Respond to external search input value changes
  useEffect(() => {
    if (searchValue !== undefined) {
      // Update form's registration number from header input
      setSuppressAutoReload(true)
      setFormData((prev) => ({
        ...prev,
        registrationNumber: searchValue,
        jobCardId: searchValue.trim().length === 0 ? "" : prev.jobCardId,
      }))
      // Fetch and show suggestions
      fetchRegistrationSuggestions(searchValue)
      setShowRegistrationSuggestions(searchValue.trim().length > 0)
    }
  }, [searchValue, allVehicles])

  // Attach keyboard event handlers to external search input
  useEffect(() => {
    const inputElement = registrationInputRef?.current
    if (!inputElement) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showRegistrationSuggestions) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          dropdownNav.setHighlightedIndex((prev) =>
            prev < registrationSuggestions.length - 1 ? prev + 1 : prev
          )
          break
        case "ArrowUp":
          e.preventDefault()
          dropdownNav.setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
          break
        case "Enter":
          e.preventDefault()
          if (dropdownNav.highlightedIndex >= 0 && dropdownNav.highlightedIndex < registrationSuggestions.length) {
            handleSelectRegistrationSuggestion(registrationSuggestions[dropdownNav.highlightedIndex])
          }
          break
        case "Escape":
          e.preventDefault()
          setShowRegistrationSuggestions(false)
          break
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      // Keep dropdown open if clicking inside dropdown or on input
      if (inputElement.contains(e.target as Node)) return
      if (dropdownContainerRef.current?.contains(e.target as Node)) return
      setShowRegistrationSuggestions(false)
    }

    inputElement.addEventListener("keydown", handleKeyDown)
    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      inputElement.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [registrationInputRef, showRegistrationSuggestions, registrationSuggestions, dropdownNav, handleSelectRegistrationSuggestion])

  // Auto-detect taxable status: if any service has tax data, set taxable to true
  useEffect(() => {
    const hasTaxData = services.some(
      (service) =>
        Number(service.cgstRate || 0) > 0 ||
        Number(service.sgstRate || 0) > 0 ||
        Number(service.igstRate || 0) > 0 ||
        Number(service.cgstAmount || 0) > 0 ||
        Number(service.sgstAmount || 0) > 0 ||
        Number(service.igstAmount || 0) > 0
    );

    if (hasTaxData && !formData.taxable) {
      setFormData((prev) => ({ ...prev, taxable: true }));
    }
  }, [services, formData.taxable]);

  // Load all under-service vehicles on component mount
  useEffect(() => {
    const loadUnderServiceVehicles = async () => {
      try {
        const response = await fetch("/api/jobcards/under-service")
        const data = await response.json()
        
        if (Array.isArray(data)) {
          const vehicles = data.map((jobCard: any) => ({
            id: jobCard.id,
            fileNo: jobCard.fileNo || "",
            mobileNo: jobCard.customer?.mobileNo || "",
            registrationNumber: jobCard.vehicle?.registrationNumber || "",
            customerName: jobCard.customer?.name || "",
            jobCardNumber: jobCard.jobCardNumber,
            vehicleMake: jobCard.vehicle?.make || "",
            vehicleModel: jobCard.vehicle?.model || "",
          }))
          setAllVehicles(vehicles)
        }
      } catch (error) {
        console.error("Error loading under-service vehicles:", error)
      }
    }
    loadUnderServiceVehicles()
  }, [])

  // Load shop state on component mount
  useEffect(() => {
    const fetchShopState = async () => {
      try {
        const response = await fetch("/api/settings/shop")
        const data = await response.json()
        if (data.stateId) {
          setShopStateId(data.stateId)
        }
      } catch (error) {
        console.error("Error fetching shop state:", error)
      }
    }
    fetchShopState()
  }, [])

  // Load active technicians for allocation dropdown
  useEffect(() => {
    fetch("/api/technicians?isActive=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.technicians)) {
          setTechnicianOptions(
            data.technicians.map((t: any) => ({ id: t.employeeId as number, name: t.name as string }))
          )
        }
      })
      .catch(() => {})
  }, [])

  // Load customer state when job card loads
  useEffect(() => {
    if (formData.customerId) {
      const fetchCustomerState = async () => {
        try {
          const response = await fetch(`/api/customers/${formData.customerId}`)
          const data = await response.json()
          if (data.stateId) {
            setCustomerStateId(data.stateId)
          }
          if (data.state) {
            setCustomerStateName(data.state)
          }
        } catch (error) {
          console.error("Error fetching customer state:", error)
        }
      }
      fetchCustomerState()
    }
  }, [formData.customerId])

  const sparesTotal = useMemo(
    () => spareParts.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [spareParts]
  )

  const spareReturnsTotal = useMemo(
    () =>
      sparePartReturns
        .filter(isSparePartReturnRowTouched)
        .reduce((sum, row) => sum + (Number(row.returnAmount) || 0), 0),
    [sparePartReturns]
  )

  const serviceTotal = useMemo(
    () => services.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [services]
  )

  const sparePartBillOptions = useMemo(
    () =>
      Array.from(
        new Set(
          spareParts
            .filter(isSparePartRowTouched)
            .map((row) => row.billNumber.trim())
            .filter(Boolean)
        )
      ),
    [spareParts]
  )

  useEffect(() => {
    const total = Math.max(sparesTotal + serviceTotal - spareReturnsTotal, 0)
    const discount = Number(formData.discount) || 0
    const totalBill = Math.max(total - discount, 0)
    const paid = Number(formData.paid) || 0
    const advance = Number(formData.advance) || 0
    const balance = Math.max(totalBill - paid - advance, 0)

    setFormData((prev) => ({
      ...prev,
      total,
      totalBill,
      balance,
      advancePayment: advance,
    }))
  }, [sparesTotal, serviceTotal, spareReturnsTotal, formData.discount, formData.paid, formData.advance])

  useEffect(() => {
    const filledTransactions = financialTransactions.filter(
      (row) => Number(row.transactionAmount || 0) > 0
    )

    const paidFromTransactions = filledTransactions
      .filter((row) => normalizeApplyTo(row.applyTo) === "bill payment")
      .reduce((sum, row) => sum + Number(row.transactionAmount || 0), 0)

    const advanceFromTransactions = filledTransactions
      .filter((row) => normalizeApplyTo(row.applyTo) === "advance payment")
      .reduce((sum, row) => sum + Number(row.transactionAmount || 0), 0)

    setFormData((prev) => {
      const nextStatus = derivePaymentStatus(
        Number(prev.totalBill || 0),
        paidFromTransactions,
        advanceFromTransactions
      )

      if (
        Number(prev.paid || 0) === paidFromTransactions &&
        Number(prev.advance || 0) === advanceFromTransactions &&
        Number(prev.advancePayment || 0) === advanceFromTransactions &&
        (prev.jobcardPaymentStatus || "Pending") === nextStatus
      ) {
        return prev
      }

      return {
        ...prev,
        paid: paidFromTransactions,
        advance: advanceFromTransactions,
        advancePayment: advanceFromTransactions,
        jobcardPaymentStatus: nextStatus,
      }
    })
  }, [financialTransactions])

  const isDirty = useMemo(() => {
    const current = JSON.stringify({ formData, spareParts, sparePartReturns, services, technicians, financialTransactions })
    return initialSnapshotRef.current !== "" && current !== initialSnapshotRef.current
  }, [formData, spareParts, sparePartReturns, services, technicians, financialTransactions])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return
      }
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  // Attach event handlers to external search input if provided
  useEffect(() => {
    const inputElement = registrationInputRef?.current
    if (inputElement && searchInputRef) {
      const handleChange = (e: Event) => {
        const value = (e.target as HTMLInputElement).value
        handleRegistrationInputChange({
          target: { value: value.toUpperCase() }
        } as any)
      }
      
      const handleKeyDown = (e: KeyboardEvent) => {
        dropdownNav.handleKeyDown(e as any)
      }

      const handleClick = () => {
        setShowRegistrationSuggestions(true)
        setRegistrationSuggestions(allVehicles)
        dropdownNav.resetHighlight()
      }

      inputElement.addEventListener('change', handleChange)
      inputElement.addEventListener('keydown', handleKeyDown)
      inputElement.addEventListener('click', handleClick)
      inputElement.addEventListener('focus', handleClick)

      return () => {
        inputElement.removeEventListener('change', handleChange)
        inputElement.removeEventListener('keydown', handleKeyDown)
        inputElement.removeEventListener('click', handleClick)
        inputElement.removeEventListener('focus', handleClick)
      }
    }
  }, [searchInputRef, registrationInputRef, dropdownNav, allVehicles, handleRegistrationInputChange])

  useEffect(() => {
    const fetchStates = async () => {
      if (!formData.taxable) {
        return
      }

      try {
        setIsLoadingStates(true)
        const response = await fetch("/api/settings/states")
        const data = await response.json()
        
        if (Array.isArray(data)) {
          setStates(data)
        } else if (data.states && Array.isArray(data.states)) {
          setStates(data.states)
        }
        setShowCustomerStateForm(true)
      } catch (error) {
        console.error("Error fetching states:", error)
        notify.warn("Failed to load states")
      } finally {
        setIsLoadingStates(false)
      }
    }

    if (formData.taxable) {
      fetchStates()
    }
  }, [formData.taxable])

  const handleTaxableToggle = (isTaxable: boolean) => {
    setFormData((prev) => ({ ...prev, taxable: isTaxable }))

    if (isTaxable) {
      setShowCustomerStateForm(true)
      if (!selectedStateId) {
        const preselect = states.find(s => s.stateCode === customerStateId || s.stateId === customerStateId)
          || states.find(s => s.stateCode === shopStateId || s.stateId === shopStateId)
        if (preselect) setSelectedStateId(preselect.stateId)
      }
      return
    }

    services.forEach((service) => {
      updateServiceRow(service.id, {
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        igstRate: 0,
        igstAmount: 0,
        stateId: undefined,
        totalAmount: service.amount,
      } as Partial<ServiceRow>)
    })
  }

  const handleMaintenanceTypeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, maintenanceType: value }))
    
    // Show toast and focus odo only when user selects Oil Change
    if (value === "Oil Change") {
      setTimeout(() => {
        odoInputRef.current?.focus()
      }, 100)
      notify.info("Please update the ODO reading for Oil Change service")
    }
  }

  const handleSparePartChange = (
    rowId: string,
    field: keyof Omit<SparePartRow, "id">,
    value: string | number | boolean
  ) => {
    updateSparePartRow(rowId, { [field]: field === 'amount' ? Number(value) || 0 : value } as Partial<SparePartRow>)
  }

  const handleSparePartRowFocus = (rowId: string) => {
    // Do not auto-insert a new spare part row on focus. New rows are
    // created when the user changes the last row (see handleSparePartChange).
    return
  }

  const handleServiceChange = (
    rowId: string,
    field: keyof Omit<ServiceRow, "id">,
    value: string | number
  ) => {
    const numericFields = ['amount', 'quantity', 'cgstRate', 'sgstRate', 'igstRate'] as const

    const newVal = numericFields.includes(field as any) ? Number(value) || 0 : value

    const current = services.find((s) => s.id === rowId) || createServiceRow()
    const updated: ServiceRow = {
      ...current,
      [field]: newVal,
    } as ServiceRow

    const amount = Number(updated.amount || 0)
    
    // Determine if customer is from different state
    const isDifferentState = customerStateId && shopStateId && customerStateId !== shopStateId
    
    let cgstRate = 0
    let sgstRate = 0
    let igstRate = 0

    if (isDifferentState) {
      // Different state: Use IGST, clear CGST/SGST
      igstRate = Number(updated.igstRate || 0)
      cgstRate = 0
      sgstRate = 0
    } else {
      // Same state: Use CGST/SGST, clear IGST
      cgstRate = Number(updated.cgstRate || 0)
      sgstRate = cgstRate // SGST is always equal to CGST
      igstRate = 0
    }

    const cgstAmount = parseFloat(((amount * cgstRate) / 100).toFixed(2))
    const sgstAmount = parseFloat(((amount * sgstRate) / 100).toFixed(2))
    const igstAmount = parseFloat(((amount * igstRate) / 100).toFixed(2))

    const totalAmount = igstRate > 0
      ? parseFloat((amount + igstAmount).toFixed(2))
      : parseFloat((amount + cgstAmount + sgstAmount).toFixed(2))

    updateServiceRow(rowId, {
      [field]: newVal,
      sgstRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
    } as Partial<ServiceRow>)
  }

  const handleSparePartReturnChange = (
    rowId: string,
    field: keyof Omit<SparePartReturnRow, "id">,
    value: string | number
  ) => {
    updateSparePartReturnRow(rowId, { [field]: field === 'returnAmount' ? Number(value) || 0 : value } as Partial<SparePartReturnRow>)
  }

  const handleSparePartReturnRowFocus = (rowId: string) => {
    // No-op on focus; row insertion happens on change
    return
  }

  const handleServiceRowFocus = (rowId: string) => {
    // No-op on focus; row insertion happens on change
    return
  }

  const handleTechnicianChange = (
    rowId: string,
    field: keyof Omit<TechnicianRow, "id">,
    value: string | number
  ) => {
    updateTechnicianRow(rowId, { [field]: field === 'allocationAmount' ? Number(value) || 0 : value } as Partial<TechnicianRow>)
  }

  const handleTechnicianRowFocus = (rowId: string) => {
    // No-op on focus; row insertion happens on change
    return
  }

  const openTechnicianDropdown = (rowId: string) => {
    const input = technicianRefsMap.current.get(`${rowId}-employeeName`)
    if (!input) return
    const rect = input.getBoundingClientRect()
    setTechnicianDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
    setOpenTechnicianDropdownRowId(rowId)
  }

  const loadJobCard = async (jobCardId?: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    console.log("loadJobCard called with:", { jobCardId, registrationNumber: formData.registrationNumber })
    
    if (!jobCardId && !formData.registrationNumber.trim()) {
      errorAction("Enter Registration Number to find a JobCard")
      return
    }

    try {
      setIsLoadingRecord(true)
      if (!silent) {
        startAction("Loading job card...")
      }
      console.debug("loadJobCard:start", { jobCardId, registrationNumber: formData.registrationNumber, silent })

      const query = new URLSearchParams()
      if (jobCardId) {
        query.set("id", jobCardId)
      } else {
        const registrationNumber = formData.registrationNumber.trim().toUpperCase()
        if (registrationNumber) {
          query.set("registrationNumber", registrationNumber)
        }
      }

      if (!query.toString()) {
        errorAction("No search criteria provided")
        setIsLoadingRecord(false)
        return
      }

      const response = await fetch(`/api/jobcards/find?${query.toString()}`)
      const data = await response.json()

      console.debug("loadJobCard:fetched", { ok: response.ok, id: data?.id, spares: (data?.spares || []).length, services: (data?.services || []).length, technicians: (data?.technicians || []).length })

      if (!response.ok) {
        const message = data?.error || "JobCard not found"
        errorAction(message)
        setIsLoadingRecord(false)
        return
      }

      // Prevent loading job cards with "Delivered" status
      if (data.vehicleStatus === "Delivered") {
        // Track failed attempts to prevent repeated queries
        failedLoadAttemptRef.current.add(data.id)
        // Only show error once for this delivered job card
        if (rejectedDeliveredRef.current !== data.id) {
          errorAction("This job card has been delivered and cannot be edited in Under Service section")
          rejectedDeliveredRef.current = data.id
        }
        setIsLoadingRecord(false)
        return
      }
      
      // Clear the rejected delivered ref when loading a non-delivered job card
      rejectedDeliveredRef.current = ""

      setFormData({
        jobCardId: data.id,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        fileNo: data.fileNo || "",
        mobileNo: data.customer?.mobileNo || "",
        registrationNumber: data.vehicle?.registrationNumber || "",
        customerName: data.customer?.name || "",
        vehicleModel: `${data.vehicle?.make || ""} ${data.vehicle?.model || ""}`.trim(),
        jobcardDate: formatDateDDMMYY(new Date(data.serviceDate)),
        jobcardStatus: data.jobcardStatus || "Under Service",
        deliveryStatus: data.vehicleStatus || "Pending",
        deliveryDate: formatDateDDMMYY(data.deliveryDate),
        maintenanceType: data.maintenanceType || "General Maint.",
        odo: data.kmDriven ? String(data.kmDriven) : "",
        total: Number(data.total || 0),
        discount: Number(data.discount || 0),
        totalBill: Number(data.total || 0),
        advance: Number(data.advancePayment || 0),
        taxable: Boolean(data.taxable),
        advancePayment: Number(data.advancePayment || 0),
        balance: Number(data.balance || 0),
        paid: Number(data.paidAmount || 0),
        jobcardPaymentStatus: data.paymentStatus || "Pending",
        externalShop: Boolean(data.externalShop),
        externalShopRemarks: data.externalShopRemarks || "",
      })

      const loadedSpareParts = (data.spares || [])
        .filter((item: any) => !Boolean(item.isReturn))
        .map((item: any) => ({
          id: item.id,
          shopName: item.shopName ?? "",
          billDate: formatDateDDMMYY(item.billDate),
          billNumber: item.billNumber ?? "",
          item: item.item ?? "",
          amount: Number(item.amount || 0),
          paid: Number(item.paid || 0),
          paidDate: formatDateDDMMYY(item.paidDate),
          isReturn: false,
          returnDate: "",
          returnAmount: 0,
        })) as SparePartRow[]

      const loadedSparePartReturns = (data.spares || [])
        .filter((item: any) => Boolean(item.isReturn))
        .map((item: any) => ({
          id: `ret-${item.id}`,
          billNumber: item.billNumber ?? "",
          returnedItem: item.returnedItem ?? "",
          returnDate: formatDateDDMMYY(item.returnedDate),
          returnAmount: Number(item.returnAmount || 0),
        })) as SparePartReturnRow[]

      const loadedServices = (data.services || []).map((item: any) => ({
        id: item.id,
        description: item.description ?? "",
        unit: item.unit ?? "",
        quantity: Number(item.quantity || 1),
        amount: Number(item.amount || 0),
        discountRate: Number(item.discountRate || 0),
        discountAmount: Number(item.discountAmount || 0),
        cgstRate: Number(item.cgstRate || 0),
        cgstAmount: Number(item.cgstAmount || 0),
        sgstRate: Number(item.sgstRate || 0),
        sgstAmount: Number(item.sgstAmount || 0),
        igstRate: Number(item.igstRate || 0),
        igstAmount: Number(item.igstAmount || 0),
        totalAmount: Number(item.totalAmount || 0),
        stateId: item.stateId ?? "",
      })) as ServiceRow[]

      const loadedTechnicians = (data.technicians || []).map((item: any) => ({
        id: item.id,
        employeeName: item.employeeName || "",
        taskAssigned: item.taskAssigned || "",
        allocationAmount: Number(item.allocationAmount || 0),
      })) as TechnicianRow[]

      const loadedFinancialTransactions = (data.financialTransactions || []).map((item: any) => ({
        id: item.id,
        transactionType: item.transactionType || "",
        transactionDate: formatDateDDMMYY(item.transactionDate),
        paymentType: item.paymentType || "",
        applyTo: item.applyTo || "",
        transactionAmount: Number(item.transactionAmount || 0),
        description: item.description || "",
      })) as FinancialTransactionRow[]

      // Only keep meaningful (touched) rows when loading; do not add trailing blank rows.
      const meaningfulSpareParts = (loadedSpareParts || []).filter(isSparePartRowTouched)
      const meaningfulSparePartReturns = (loadedSparePartReturns || []).filter(isSparePartReturnRowTouched)
      const meaningfulServices = (loadedServices || []).filter(isServiceRowTouched)
      const meaningfulTechnicians = (loadedTechnicians || []).filter(isTechnicianRowTouched)
      const meaningfulFinancialTransactions = (loadedFinancialTransactions || [])

      setSpareParts(meaningfulSpareParts)
      setSparePartReturns(meaningfulSparePartReturns)
      setServices(meaningfulServices)
      setTechnicians(meaningfulTechnicians)
      setFinancialTransactions(meaningfulFinancialTransactions)

      console.debug("loadJobCard:applied", { spareParts: meaningfulSpareParts.length, sparePartReturns: meaningfulSparePartReturns.length, services: meaningfulServices.length, technicians: meaningfulTechnicians.length, financialTransactions: meaningfulFinancialTransactions.length })
      console.debug("loadJobCard:financialTransactionsData", meaningfulFinancialTransactions)

      setSuppressAutoReload(false)

      const snapshot = JSON.stringify({
        formData: {
          jobCardId: data.id,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          fileNo: data.fileNo || "",
          mobileNo: data.customer?.mobileNo || "",
          registrationNumber: data.vehicle?.registrationNumber || "",
          customerName: data.customer?.name || "",
          vehicleModel: `${data.vehicle?.make || ""} ${data.vehicle?.model || ""}`.trim(),
          jobcardDate: formatDateDDMMYY(new Date(data.serviceDate)),
          jobcardStatus: data.jobcardStatus || "Under Service",
        
          deliveryStatus: data.vehicleStatus || "Pending",
          deliveryDate: formatDateDDMMYY(data.deliveryDate),
          maintenanceType: data.maintenanceType || "General Maint.",
          odo: data.kmDriven ? String(data.kmDriven) : "",
          total: Number(data.total || 0),
          discount: Number(data.discount || 0),
          totalBill: Number(data.total || 0),
          advance: Number(data.advancePayment || 0),
          taxable: Boolean(data.taxable),
          advancePayment: Number(data.advancePayment || 0),
          balance: Number(data.balance || 0),
          jobcardPaymentStatus: data.paymentStatus || "Pending",
        },
        spareParts: meaningfulSpareParts,
        sparePartReturns: meaningfulSparePartReturns,
        services: meaningfulServices,
        technicians: meaningfulTechnicians,
        financialTransactions: meaningfulFinancialTransactions,
      })

      initialSnapshotRef.current = snapshot
      setShowRegistrationSuggestions(false)
      onJobCardLoaded?.(data.id)
      if (!silent) {
        successAction("JobCard loaded")
      }
    } catch (error) {
      // Avoid throwing to console for not-found cases; we show the toast instead
      console.error("Error loading jobcard:", error)
      errorAction(error instanceof Error ? error.message : "Failed to load jobcard")
    } finally {
      setIsLoadingRecord(false)
      setShowRegistrationSuggestions(false)
    }
  }

  // Update the ref whenever loadJobCard is defined
  useEffect(() => {
    loadJobCardRef.current = loadJobCard
  }, [])

  const handleJobCardStatusChange = (value: string) => {
    setFormData((prev) => ({ ...prev, jobcardStatus: value }))
    
    // When completed is selected, focus and open delivery status
    if (value === "Completed") {
      setTimeout(() => {
        openDeliveryStatusDropdown()
      }, 0)
    }
  }

  const handleDeliveryStatusChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      deliveryStatus: value,
      deliveryDate: value === "Delivered" ? formatDateDDMMYY(new Date()) : "",
    }))
    
    // Once delivery status is updated, focus and open payment status
    setTimeout(() => {
      openPaymentStatusDropdown()
    }, 0)
  }

  // Validation functions for sub-forms
  const validateSparePartsForm = (): { valid: boolean; missingFieldInfo?: string } => {
    const touchedParts = spareParts.filter(isSparePartRowTouched)
    for (const part of touchedParts) {
      if (!part.shopName?.trim()) {
        sparePartRefsMap.current.get(`${part.id}-shopName`)?.focus()
        return { valid: false, missingFieldInfo: "Shop Name is required in Spare Parts" }
      }
      if (!part.billNumber?.trim()) {
        sparePartRefsMap.current.get(`${part.id}-billNumber`)?.focus()
        return { valid: false, missingFieldInfo: "Bill Number is required in Spare Parts" }
      }
      if (!part.item?.trim()) {
        sparePartRefsMap.current.get(`${part.id}-item`)?.focus()
        return { valid: false, missingFieldInfo: "Item is required in Spare Parts" }
      }
      if (!part.amount || part.amount <= 0) {
        sparePartRefsMap.current.get(`${part.id}-amount`)?.focus()
        return { valid: false, missingFieldInfo: "Amount must be greater than 0 in Spare Parts" }
      }
    }
    return { valid: true }
  }

  const validateServicesForm = (): { valid: boolean; missingFieldInfo?: string } => {
    const touchedServices = services.filter(isServiceRowTouched)
    for (const service of touchedServices) {
      if (!service.description?.trim()) {
        serviceRefsMap.current.get(`${service.id}-description`)?.focus()
        return { valid: false, missingFieldInfo: "Description is required in Service Description" }
      }
      if (!service.amount || service.amount <= 0) {
        serviceRefsMap.current.get(`${service.id}-amount`)?.focus()
        return { valid: false, missingFieldInfo: "Amount must be greater than 0 in Service Description" }
      }
    }
    return { valid: true }
  }

  const validateTechniciansForm = (): { valid: boolean; missingFieldInfo?: string } => {
    const touchedTechs = technicians.filter(isTechnicianRowTouched)
    for (const tech of touchedTechs) {
      if (!tech.employeeName?.trim()) {
        technicianRefsMap.current.get(`${tech.id}-employeeName`)?.focus()
        return { valid: false, missingFieldInfo: "Employee Name is required in Technician Allocation" }
      }
      if (!tech.taskAssigned?.trim()) {
        technicianRefsMap.current.get(`${tech.id}-taskAssigned`)?.focus()
        return { valid: false, missingFieldInfo: "Task Assigned is required in Technician Allocation" }
      }
    }
    return { valid: true }
  }

  const validateFinancialTransactionsForm = (): { valid: boolean; missingFieldInfo?: string } => {
    const filledTransactions = financialTransactions.filter(
      (row) => row.transactionType || row.paymentType || row.applyTo || row.transactionAmount > 0
    )
    for (const transaction of filledTransactions) {
      if (!transaction.transactionType?.trim()) {
        return { valid: false, missingFieldInfo: "Transaction Type is required in Financial Transactions" }
      }
      if (!transaction.transactionDate?.trim()) {
        return { valid: false, missingFieldInfo: "Date is required in Financial Transactions" }
      }
      if (!transaction.paymentType?.trim()) {
        return { valid: false, missingFieldInfo: "Payment Type is required in Financial Transactions" }
      }
      if (!transaction.applyTo?.trim()) {
        return { valid: false, missingFieldInfo: "Apply To is required in Financial Transactions" }
      }
      if (!transaction.transactionAmount || transaction.transactionAmount <= 0) {
        return { valid: false, missingFieldInfo: "Amount must be greater than 0 in Financial Transactions" }
      }
    }
    return { valid: true }
  }

  const handleSave = async () => {
    console.log("handleSave: Started", { jobCardId: formData.jobCardId, financialTransactionsCount: financialTransactions.length })
    
    if (!formData.jobCardId || !formData.customerId || !formData.vehicleId) {
      errorAction("Load a valid JobCard first")
      return
    }

    // Validate sub-forms
    console.log("handleSave: Validating spare parts")
    const sparePartsValidation = validateSparePartsForm()
    if (!sparePartsValidation.valid) {
      errorAction(sparePartsValidation.missingFieldInfo || "Missing required fields in Spare Parts")
      return
    }

    const servicesValidation = validateServicesForm()
    if (!servicesValidation.valid) {
      errorAction(servicesValidation.missingFieldInfo || "Missing required fields in Service Description")
      return
    }

    const techniciansValidation = validateTechniciansForm()
    if (!techniciansValidation.valid) {
      errorAction(techniciansValidation.missingFieldInfo || "Missing required fields in Technician Allocation")
      return
    }

    console.log("handleSave: Validating financial transactions", { count: financialTransactions.length })
    const financialTransactionsValidation = validateFinancialTransactionsForm()
    if (!financialTransactionsValidation.valid) {
      errorAction(financialTransactionsValidation.missingFieldInfo || "Missing required fields in Financial Transactions")
      return
    }
    console.log("handleSave: All validations passed")

    // Validate delivery status when jobcard status is completed
    if (formData.jobcardStatus === "Completed" && formData.deliveryStatus === "Pending") {
      errorAction("Please update delivery status when job card is completed")
      openDeliveryStatusDropdown()
      return
    }

    // Validate payment status when jobcard status is completed
    if (formData.jobcardStatus === "Completed" && formData.jobcardPaymentStatus === "Pending") {
      errorAction("Please update payment status before completing the job card")
      openPaymentStatusDropdown()
      return
    }

    // maintenanceType removed - no longer required

    try {
      setIsLoading(true)
      console.log("handleSave: Starting data preparation")

      const preparedSpareParts = spareParts.filter(isSparePartRowTouched).map((row) => {
        const normalizedBillDate = parseDDMMYYToISO(row.billDate)
        if (row.billDate.trim() && !normalizedBillDate) {
          throw new Error("Bill Date must be in dd-mm-yy format")
        }

        const normalizedPaidDate = row.paidDate ? parseDDMMYYToISO(row.paidDate) : ""
        if ((row.paidDate || "").trim() && !normalizedPaidDate) {
          throw new Error("Paid Date must be in dd-mm-yy format")
        }

        return {
          ...row,
          billDate: normalizedBillDate || "",
          paid: Number(row.paid || 0),
          paidDate: normalizedPaidDate || "",
          isReturn: false,
          returnDate: "",
          returnAmount: 0,
        }
      })
      console.log("handleSave: Prepared spare parts", { count: preparedSpareParts.length })

      const preparedSparePartReturns = sparePartReturns
        .filter(isSparePartReturnRowTouched)
        .map((row) => {
          if (!row.billNumber.trim()) {
            throw new Error("Select Bill Number in Spare Part Return form")
          }

          if (!row.returnedItem.trim()) {
            throw new Error("Enter Returned Item in Spare Part Return form")
          }

          const normalizedReturnDate = parseDDMMYYToISO(row.returnDate)
          if (row.returnDate.trim() && !normalizedReturnDate) {
            throw new Error("Return Date must be in dd-mm-yy format")
          }

          return {
            ...row,
            billNumber: row.billNumber.trim(),
            returnedItem: row.returnedItem.trim(),
            returnDate: normalizedReturnDate || "",
          }
        })

      console.log("handleSave: Prepared spare part returns", { count: preparedSparePartReturns.length })

      const returnByBillNumber = new Map(
        preparedSparePartReturns.map((row) => [row.billNumber, row])
      )

      const mergedSpareParts = preparedSpareParts.map((row) => {
        const returnRow = returnByBillNumber.get(row.billNumber.trim())
        if (!returnRow) {
          return row
        }

        return {
          ...row,
          isReturn: true,
          returnedItem: returnRow.returnedItem,
          returnDate: returnRow.returnDate,
          returnAmount: Number(returnRow.returnAmount || 0),
          paid: Number(row.paid || 0),
          paidDate: row.paidDate || "",
        }
      })

      console.log("handleSave: Merged spare parts", { count: mergedSpareParts.length })

      const preparedServices = services
        .filter(isServiceRowTouched)
        .map((row) => ({
          description: row.description || "",
          unit: row.unit || null,
          quantity: Number(row.quantity || 1),
          amount: Number(row.amount || 0),
          discountRate: Number((row as any).discountRate || 0),
          discountAmount: Number((row as any).discountAmount || 0),
          cgstRate: Number((row as any).cgstRate || 0),
          cgstAmount: Number((row as any).cgstAmount || 0),
          sgstRate: Number((row as any).sgstRate || 0),
          sgstAmount: Number((row as any).sgstAmount || 0),
          igstRate: Number((row as any).igstRate || 0),
          igstAmount: Number((row as any).igstAmount || 0),
          totalAmount: Number((row as any).totalAmount || 0),
          stateId: row.stateId || null,
        }))

      console.log("handleSave: Prepared services", { count: preparedServices.length })

      const preparedFinancialTransactions = financialTransactions
        .filter(
          (row) => row.transactionType && row.transactionDate && row.paymentType && row.applyTo && row.transactionAmount > 0
        )
        .map((row) => {
          console.log("Processing financial transaction:", { 
            id: row.id, 
            transactionDate: row.transactionDate,
            transactionType: row.transactionType
          })
          const normalizedDate = parseDDMMYYToISO(row.transactionDate)
          console.log("After date parsing:", { 
            original: row.transactionDate, 
            normalized: normalizedDate 
          })
          if (row.transactionDate.trim() && !normalizedDate) {
            throw new Error("Transaction Date must be in dd-mm-yy format")
          }
          return {
            ...row,
            transactionDate: normalizedDate || "",
          }
        })

      console.log("handleSave: Prepared financial transactions", { count: preparedFinancialTransactions.length })

      console.debug("handleSave:preparedData", { 
        spareParts: mergedSpareParts.length, 
        services: preparedServices.length, 
        technicians: technicians.filter(isTechnicianRowTouched).length,
        financialTransactions: preparedFinancialTransactions.length,
        financialTransactionsContent: preparedFinancialTransactions
      })

      const normalizedServiceDate = parseDDMMYYToISO(formData.jobcardDate)
      if (!normalizedServiceDate) {
        throw new Error("Jobcard Date must be in dd-mm-yy format")
      }

      const normalizedDeliveryDate = formData.deliveryDate
        ? parseDDMMYYToISO(formData.deliveryDate)
        : ""

      console.log("handleSave: About to make API call")

      const response = await fetch(`/api/jobcards/${formData.jobCardId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        
        body: JSON.stringify({
          customerId: formData.customerId,
          vehicleId: formData.vehicleId,
          fileNo: formData.fileNo || null,
          serviceDate: normalizedServiceDate,
          jobcardStatus: formData.jobcardStatus,
          deliveryStatus: formData.deliveryStatus,
          deliveryDate:
            formData.deliveryStatus === "Delivered"
              ? normalizedDeliveryDate || parseDDMMYYToISO(formatDateDDMMYY(new Date()))
              : null,
          maintenanceType: formData.maintenanceType || null,
          odo: formData.odo ? Number(formData.odo) : null,
          total: Number(formData.total || 0),
          discount: Number(formData.discount || 0),
          totalBill: Number(formData.totalBill || 0),
          advance: Number(formData.paid || 0),
          taxable: Boolean(formData.taxable),
          advancePayment: Number(formData.advance || 0),
          balance: Number(formData.balance || 0),
          paymentStatus: formData.jobcardPaymentStatus || "Pending",
          externalShop: Boolean(formData.externalShop),
          externalShopRemarks: formData.externalShopRemarks || null,
          spareParts: mergedSpareParts,
          services: preparedServices,
          technicians: technicians.filter(isTechnicianRowTouched),
          financialTransactions: preparedFinancialTransactions,
        }),
      })

      console.log("handleSave: API response received", { status: response.status, statusText: response.statusText })

      const data = await response.json()
      console.log("handleSave: Response JSON parsed", { hasError: !!data.error, error: data.error })

      if (!response.ok) {
        throw new Error(data.error || "Failed to update jobcard")
      }

      console.debug("handleSave:apiResponse", { financialTransactions: data.financialTransactions })

      initialSnapshotRef.current = JSON.stringify({ formData, spareParts, sparePartReturns, services, technicians, financialTransactions })
      successAction("JobCard updated successfully")
      
      // Clear form after successful save
      setSuppressAutoReload(true)
      setFormData(emptyForm)
      setSpareParts([])
      setSparePartReturns([])
      setServices([])
      setTechnicians([])
      setFinancialTransactions([])
      // Reset suppressAutoReload after a moment so future manual selections work
      setTimeout(() => setSuppressAutoReload(false), 100)
    } catch (error) {
      console.error("Error updating jobcard:", error)
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack")
      console.error("Error details:", { 
        message: error instanceof Error ? error.message : String(error),
        type: typeof error
      })
      errorAction(error instanceof Error ? error.message : "Failed to update jobcard")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!formData.jobCardId) {
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch(`/api/jobcards/${formData.jobCardId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete jobcard")
      }

      const deletedJobCardId = formData.jobCardId
      setSuppressAutoReload(true)
      setFormData(emptyForm)
      setSpareParts([])
      setSparePartReturns([])
      setServices([])
      setTechnicians([])
      initialSnapshotRef.current = ""
      onJobCardDeleted?.(deletedJobCardId)
      setDeleteDialogOpen(false)
      successAction("JobCard deleted successfully")
      // Reset suppressAutoReload after a moment so future manual selections work
      setTimeout(() => setSuppressAutoReload(false), 100)
    } catch (error) {
      console.error("Error deleting jobcard:", error)
      errorAction(error instanceof Error ? error.message : "Failed to delete jobcard")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveFinancialTransaction = async (data: FinancialTransactionData) => {
    try {
      const isUpdate = data.mode === "update" && Number.isFinite(data.transactionId)
      const endpoint = isUpdate
        ? `/api/financial-transactions/${data.transactionId}`
        : "/api/financial-transactions"
      const method = isUpdate ? "PUT" : "POST"

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleId: formData.vehicleId,
          jobCardId: formData.jobCardId || null,
          transactionType: data.transactionType,
          transactionDate: data.transactionDate,
          paymentType: data.paymentType,
          description: data.description,
          transactionAmount: data.transactionAmount,
          paid: data.paid,
          advance: data.advance,
          customerName: formData.customerName || data.customerName,
          mobileNumber: formData.mobileNo || data.mobileNumber,
          vehicleMake: formData.vehicleModel || data.vehicleMake,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to save financial transaction")
      }

      if (!isUpdate && data.transactionType === "Income") {
        const billPaymentAmount = Number(data.paid || 0)
        const advancePaymentAmount = Number(data.advance || 0)
        
        setFormData((prev) => {
          let newAdvance = Number(prev.advance || 0)
          let newAdvancePayment = Number(prev.advancePayment || 0)

          if (billPaymentAmount > 0) {
            newAdvance = newAdvance + billPaymentAmount
          }
          if (advancePaymentAmount > 0) {
            newAdvancePayment = newAdvancePayment + advancePaymentAmount
          }

          return {
            ...prev,
            advance: newAdvance,
            advancePayment: newAdvancePayment,
          }
        })
      }

      return responseData
    } catch (error) {
      console.error("Error saving financial transaction:", error)
      throw error
    }
  }

  const handleSaveCustomerStateForm = async () => {
    if (!selectedStateId) {
      notify.warn("Please select a state")
      return
    }

    const selected = states.find((s) => s.stateId === selectedStateId)
    if (!selected) {
      notify.warn("Invalid state selection")
      return
    }

    try {
      setIsLoading(true)
      const stateId = selected.stateCode || selected.stateId
      const stateName = selected.stateName

      setCustomerStateId(stateId)
      setCustomerStateName(stateName)
      
      // Update all service descriptions with the new state code
      setServices((prev) =>
        prev.map((service) => ({
          ...service,
          stateId: stateId,
        }))
      )
      
      // Update customer with new state
      await fetch(`/api/customers/${formData.customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateId, state: stateName }),
      })

      successAction("Customer state updated successfully")
      setShowCustomerStateForm(false)
    } catch (error) {
      console.error("Error updating customer state:", error)
      errorAction(error instanceof Error ? error.message : "Failed to update state")
    } finally {
      setIsLoading(false)
    }
  }

  // State for dropdown positioning
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  // Update dropdown position and handle scroll/resize
  useEffect(() => {
    if (!showRegistrationSuggestions || !searchInputRef?.current) return

    const updateDropdownPosition = () => {
      const rect = searchInputRef.current!.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,  // Viewport coordinates for fixed positioning
        left: rect.left,
        width: rect.width,
      })
    }

    // Update position immediately and on scroll/resize
    updateDropdownPosition()
    window.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)

    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true)
      window.removeEventListener('resize', updateDropdownPosition)
    }
  }, [showRegistrationSuggestions, searchInputRef])

  // Render dropdown as a portal positioned below the search input
  const dropdownElement = showRegistrationSuggestions ? (
    <div 
      ref={dropdownContainerRef}
      className="fixed z-50"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-h-56 dropdown-scroll">
        {isLoadingSuggestions ? (
          <div className="p-3 text-sm text-gray-500">Loading...</div>
        ) : registrationSuggestions.length > 0 ? (
          registrationSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                {...dropdownNav.getItemProps(index)}
                type="button"
                onClick={() => handleSelectRegistrationSuggestion(suggestion)}
                disabled={isSelectingSuggestion || isLoadingRecord}
                className={`dropdown-item ${index === dropdownNav.highlightedIndex ? "selected" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="font-medium">
                  {suggestion.registrationNumber}
                  {[suggestion.vehicleMake, suggestion.vehicleModel].filter(Boolean).join(" ") && (
                    <span className="text-gray-500 font-normal"> - {[suggestion.vehicleMake, suggestion.vehicleModel].filter(Boolean).join(" ")}</span>
                  )}
                </div>
              </button>
            ))
        ) : (
          <div className="p-3 text-sm text-gray-500">No matching vehicles found</div>
        )}
      </div>
    </div>
  ) : null

  const technicianDropdownElement = openTechnicianDropdownRowId ? (
    <div
      ref={technicianDropdownContainerRef}
      className="fixed z-50"
      style={{
        top: `${technicianDropdownPos.top}px`,
        left: `${technicianDropdownPos.left}px`,
        width: `${technicianDropdownPos.width}px`,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="dropdown-scroll max-h-56">
        {technicianOptions.length > 0 ? (
          technicianOptions.map((tech) => {
            const selectedName =
              technicians.find((row) => row.id === openTechnicianDropdownRowId)?.employeeName || ""
            const isSelected = selectedName === tech.name
            return (
              <button
                key={tech.id}
                type="button"
                className={`dropdown-item ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  handleTechnicianChange(openTechnicianDropdownRowId, "employeeName", tech.name)
                  setOpenTechnicianDropdownRowId(null)
                }}
              >
                {tech.name}
              </button>
            )
          })
        ) : (
          <div className="dropdown-empty-state">No active technicians found</div>
        )}
      </div>
    </div>
  ) : null

  useEffect(() => {
    if (!openTechnicianDropdownRowId) return

    const updatePosition = () => {
      const input = technicianRefsMap.current.get(`${openTechnicianDropdownRowId}-employeeName`)
      if (!input) return
      const rect = input.getBoundingClientRect()
      setTechnicianDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }

    const handleOutside = (event: MouseEvent) => {
      const input = technicianRefsMap.current.get(`${openTechnicianDropdownRowId}-employeeName`)
      if (input?.contains(event.target as Node)) return
      if (technicianDropdownContainerRef.current?.contains(event.target as Node)) return
      setOpenTechnicianDropdownRowId(null)
    }

    updatePosition()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    document.addEventListener("mousedown", handleOutside)

    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
      document.removeEventListener("mousedown", handleOutside)
    }
  }, [openTechnicianDropdownRowId])

  useEffect(() => {
    const onSave = () => {
      void handleSave()
    }

    const onDelete = () => {
      setDeleteDialogOpen(true)
    }

    window.addEventListener("updateJobCard:save", onSave)
    window.addEventListener("updateJobCard:delete", onDelete)

    return () => {
      window.removeEventListener("updateJobCard:save", onSave)
      window.removeEventListener("updateJobCard:delete", onDelete)
    }
  }, [handleSave])

  return (
    <>
      {dropdownElement}
      {technicianDropdownElement}
      <div className="grid h-full min-h-0 gap-3 md:gap-6">
      {activeSubform === "main-form" && (
      <>
      {/* 5-Column x 3-Row Form Layout */}
      <div className="global-main-form-content py-3 md:py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
          {/* Row 1 */}
          <div className="grid gap-2">
            <Label htmlFor="fileNo">File No</Label>
            <Input
              id="fileNo"
              value={formData.fileNo}
              onChange={(e) => setFormData((prev) => ({ ...prev, fileNo: e.target.value }))}
              disabled={isLoading}
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input id="customerName" value={formData.customerName} readOnly disabled={true} className="h-10 bg-muted" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mobileNo">Customer Mobile</Label>
            <Input id="mobileNo" value={formData.mobileNo} readOnly disabled={true} className="h-10 bg-muted" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vehicleModel">Vehicle Model</Label>
            <Input id="vehicleModel" value={formData.vehicleModel} readOnly disabled={true} className="h-10 bg-muted" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="registrationNumber">Vehicle Registration No</Label>
            <Input id="registrationNumber" value={formData.registrationNumber} readOnly disabled={true} className="h-10 bg-muted" />
          </div>

          {/* Row 2 */}
          <div className="grid gap-2">
            <Label htmlFor="jobcardDate">Jobcard Date</Label>
            <DatePickerInput
              id="jobcardDate"
              value={formData.jobcardDate}
              onChange={(value) => setFormData((prev) => ({ ...prev, jobcardDate: value }))}
              disabled={isLoading}
              placeholder="dd-mm-yy"
              format="dd-mm-yy"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="jobcardStatus">Jobcard Status</Label>
            <Select
              value={formData.jobcardStatus}
              onValueChange={handleJobCardStatusChange}
              disabled={isLoading}
            >
              <SelectTrigger id="jobcardStatus" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_CARD_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="deliveryStatus">Delivery Status</Label>
            <Select
              value={formData.deliveryStatus}
              onValueChange={handleDeliveryStatusChange}
              disabled={isLoading || formData.jobcardStatus !== "Completed"}
            >
              <SelectTrigger 
                id="deliveryStatus" 
                className="h-10"
                ref={deliveryStatusButtonRef}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="maintenanceType">Maintenance Type</Label>
            <Select
              value={formData.maintenanceType}
              onValueChange={handleMaintenanceTypeChange}
              disabled={isLoading}
            >
              <SelectTrigger id="maintenanceType" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="odo">ODO</Label>
            <Input
              ref={odoInputRef}
              id="odo"
              type="number"
              value={formData.odo}
              onChange={(e) => setFormData((prev) => ({ ...prev, odo: e.target.value }))}
              onBlur={() => {
                // If Oil Change is selected and odo is zero, warn and refocus
                if (formData.maintenanceType === "Oil Change" && (!formData.odo || Number(formData.odo) === 0)) {
                  notify.warn("ODO reading is required for Oil Change service")
                  setTimeout(() => {
                    odoInputRef.current?.focus()
                  }, 100)
                }
              }}
              disabled={isLoading}
              className="h-10"
            />
          </div>

          {/* Row 3 */}
          <div className="grid gap-2">
            <Label htmlFor="totalBill">Total Bill</Label>
            <Input id="totalBill" value={formData.totalBill.toFixed(2)} readOnly disabled={true} className="h-10 bg-muted" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="balance">Balance</Label>
            <Input id="balance" value={formData.balance.toFixed(2)} readOnly disabled={true} className="h-10 bg-muted" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="jobcardPaymentStatus">Payment Status</Label>
            <Select
              value={formData.jobcardPaymentStatus || "Pending"}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, jobcardPaymentStatus: value }))}
              disabled={isLoading}
            >
              <SelectTrigger 
                id="jobcardPaymentStatus" 
                className="h-10"
                ref={paymentStatusButtonRef}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="paid">Paid</Label>
            <Input
              id="paid"
              type="number"
              value={formData.paid ?? 0}
              onChange={(e) => {
                const paidValue = Number(e.target.value) || 0
                setFormData((prev) => ({
                  ...prev,
                  paid: paidValue,
                  jobcardPaymentStatus: derivePaymentStatus(
                    Number(prev.totalBill || 0),
                    paidValue,
                    Number(prev.advance || 0)
                  ),
                }))
              }}
              disabled={isLoading}
              className="h-10 text-center"
              placeholder="0.00"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="advance">Advance</Label>
            <Input
              id="advance"
              type="number"
              value={formData.advance ?? 0}
              onChange={(e) => {
                const advanceValue = Number(e.target.value) || 0
                setFormData((prev) => ({
                  ...prev,
                  advance: advanceValue,
                  advancePayment: advanceValue,
                  jobcardPaymentStatus: derivePaymentStatus(
                    Number(prev.totalBill || 0),
                    Number(prev.paid || 0),
                    advanceValue
                  ),
                }))
              }}
              disabled={isLoading}
              className="h-10 text-center"
              placeholder="0.00"
            />
          </div>

          {/* Row 4 - Taxable and External Shop */}
          <div className="grid gap-2">
            <Label htmlFor="taxable" className="text-sm font-medium">Taxable</Label>
            <div className="flex items-center gap-2 h-10 border rounded-md px-3 py-2 bg-white">
              <Checkbox
                id="taxable"
                checked={!!formData.taxable}
                onCheckedChange={(v) => handleTaxableToggle(Boolean(v))}
                disabled={isLoading}
                aria-label="Taxable"
                className="w-4 h-4 aspect-square"
              />
              <span className="text-sm text-muted-foreground">
                {!!formData.taxable ? "Yes" : "No"}
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="externalShop" className="text-sm font-medium">External Shop</Label>
            <div className="flex items-center gap-2 h-10 border rounded-md px-3 py-2 bg-white">
              <Checkbox
                id="externalShop"
                checked={!!formData.externalShop}
                onCheckedChange={(v) => setFormData((prev) => ({ ...prev, externalShop: Boolean(v) }))}
                disabled={isLoading || formData.jobcardStatus === "Completed"}
                aria-label="External Shop"
                title={formData.jobcardStatus === "Completed" ? "Cannot modify when job card is completed" : ""}
                className="w-4 h-4 aspect-square"
              />
              <span className="text-sm text-muted-foreground">
                {!!formData.externalShop ? "Yes" : "No"}
              </span>
            </div>
          </div>

          <div className="col-span-1 grid gap-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="externalShopRemarks">External Shop Remarks</Label>
            <Input
              id="externalShopRemarks"
              value={formData.externalShopRemarks || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, externalShopRemarks: e.target.value }))}
              disabled={isLoading || !formData.externalShop}
              className="h-10"
              placeholder="Enter remarks"
            />
          </div>
        </div>
      </div>
      </>
      )}

      {activeSubform === "spare-parts-purchase" && (
      <SparePartsTable
        rows={spareParts}
        isLoading={isLoading}
        sparePartRefsMap={sparePartRefsMap}
        onChange={handleSparePartChange}
        onRowFocus={handleSparePartRowFocus}
        onRemoveRow={(rowId) => {
          const currentRow = spareParts.find((item) => item.id === rowId)
          if (!currentRow) {
            return
          }

          setSpareParts((prev) => {
            const filtered = prev.filter((item) => item.id !== rowId)
            const hasBillInRemaining = filtered.some(
              (item) => item.billNumber.trim() && item.billNumber.trim() === currentRow.billNumber.trim()
            )

            if (!hasBillInRemaining && currentRow.billNumber.trim()) {
              setSparePartReturns((prevReturns) =>
                prevReturns.filter((entry) => entry.billNumber.trim() !== currentRow.billNumber.trim())
              )
            }

            return filtered
          })
        }}
        onAddRow={addSparePartRow}
      />
      )}

      {activeSubform === "spare-part-return" && (
      <SparePartReturnTable
        rows={sparePartReturns}
        sparePartBillOptions={sparePartBillOptions}
        isLoading={isLoading}
        onChange={handleSparePartReturnChange}
        onRowFocus={handleSparePartReturnRowFocus}
        onRemoveRow={(rowId) => {
          setSparePartReturns((prev) => prev.filter((item) => item.id !== rowId))
        }}
        onAddRow={addSparePartReturnRow}
      />
      )}

      {activeSubform === "service-description" && (
      <div className="global-subform-table-content flex min-h-0 flex-col">
        {/* Customer State Sub-form */}
        {formData.taxable && showCustomerStateForm && (
          <CustomerStateForm
            states={states}
            selectedStateId={selectedStateId}
            isLoading={isLoading}
            isLoadingStates={isLoadingStates}
            onStateIdChange={setSelectedStateId}
            onSave={handleSaveCustomerStateForm}
          />
        )}
        
        <ServiceDescriptionTable
          rows={services}
          taxable={Boolean(formData.taxable)}
          isDifferentState={Boolean(customerStateId && shopStateId && customerStateId !== shopStateId)}
          isLoading={isLoading}
          serviceRefsMap={serviceRefsMap}
          onChange={handleServiceChange}
          onRowFocus={handleServiceRowFocus}
          onRemoveRow={(rowId) => {
            setServices((prev) => prev.filter((item) => item.id !== rowId))
          }}
          onAddRow={addServiceRow}
        />
      </div>
      )}

      {activeSubform === "technician-allocation" && (
      <TechnicianAllocationTable
        rows={technicians}
        isLoading={isLoading}
        technicianRefsMap={technicianRefsMap}
        onChange={handleTechnicianChange}
        onRowFocus={handleTechnicianRowFocus}
        onOpenDropdown={openTechnicianDropdown}
        onRemoveRow={(rowId) => {
          setTechnicians((prev) => prev.filter((item) => item.id !== rowId))
        }}
        onAddRow={addTechnicianRow}
      />
      )}

      {/* Financial Transaction Sub-form */}
      {activeSubform === "financial-transactions" && (
      <FinancialTransactionsTable
        rows={financialTransactions}
        isLoading={isLoading}
        onUpdateRow={updateFinancialTransactionRow}
        onRemoveRow={removeFinancialTransactionRow}
        onAddRow={addFinancialTransactionRow}
      />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete JobCard?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the jobcard and all
              related rows.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
    </>
  )
}

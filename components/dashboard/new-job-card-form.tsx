"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { notify, toast } from '@/components/ui/notify'
import { getMakes, getModels, addMakeModel, fetchMakesFromAPI, fetchModelsFromAPI } from '@/lib/vehicle-catalog'
import { startAction, successAction, errorAction } from "@/lib/action-feedback"
import { AddCustomerModal } from "./add-customer-modal"
import { AddVehicleModal } from "./add-vehicle-modal"
import { SHOP_CODE, JOB_CARD_STATUSES } from "@/lib/constants"
import { getTodayISODateInIndia, toProperCase, toUpperCase } from "@/lib/utils"
import { setupFormKeyboardNavigation } from "@/lib/keyboard-navigation"

interface Customer {
  id: string
  mobileNo: string
  name: string
}

interface Vehicle {
  id: string
  registrationNumber: string
  make: string
  model: string
  year: number | null
  color?: string | null
}

interface FormData {
  mobileNo: string
  customerName: string
  customerId: string
  registrationNumber: string
  vehicleId: string
  vehicleModel: string
  vehicleMake: string
  vehicleYear: string
  vehicleColor: string
  jobCardNumber: string
  date: string
  fileNo: string
  kmDriven: string
  jobcardStatus: string
}

const MOBILE_NUMBER_REGEX = /^\d{10}$/

export function NewJobCardForm() {
  const router = useRouter()
  const registrationInputRef = useRef<HTMLInputElement | null>(null)
  const modalMobileInputRef = useRef<HTMLInputElement | null>(null)
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModelName, setVehicleModelName] = useState('')
  const mobileValidationToastRef = useRef<{ value: string; timestamp: number }>({
    value: "",
    timestamp: 0,
  })
  const createdCustomerIdsRef = useRef<Set<string>>(new Set())
  const createdVehicleIdsRef = useRef<Set<string>>(new Set())
  const hasSavedJobcardRef = useRef(false)
  const modalCustomerDebounceRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Helper functions for vehicle registration matching
  const normalizeRegistration = (value: string) =>
    value.replace(/[^A-Z0-9]/gi, "").toUpperCase()

  const getRegistrationMatchScore = (registration: string, query: string) => {
    if (!query) {
      return 10
    }

    if (registration === query) {
      return 0
    }

    if (registration.startsWith(query)) {
      return 1
    }

    if (registration.includes(query)) {
      return 2
    }

    // Fuzzy subsequence match (e.g., K1 can match KA01AB1234)
    let queryIndex = 0
    let gapPenalty = 0

    for (let i = 0; i < registration.length && queryIndex < query.length; i++) {
      if (registration[i] === query[queryIndex]) {
        queryIndex++
      } else if (queryIndex > 0) {
        gapPenalty++
      }
    }

    if (queryIndex === query.length) {
      return 3 + Math.min(gapPenalty, 5)
    }

    return -1
  }

  const rollbackCreatedRecords = async () => {
    if (hasSavedJobcardRef.current) {
      return
    }

    const createdVehicleIds = Array.from(createdVehicleIdsRef.current)
    const createdCustomerIds = Array.from(createdCustomerIdsRef.current)

    for (const vehicleId of createdVehicleIds) {
      try {
        await fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}`, {
          method: "DELETE",
        })
      } catch (error) {
        console.warn("Failed to rollback created vehicle", vehicleId, error)
      }
    }

    for (const customerId of createdCustomerIds) {
      try {
        await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
          method: "DELETE",
        })
      } catch (error) {
        console.warn("Failed to rollback created customer", customerId, error)
      }
    }

    createdVehicleIdsRef.current.clear()
    createdCustomerIdsRef.current.clear()
  }

  const rollbackCreatedRecordsOnUnload = () => {
    if (hasSavedJobcardRef.current) {
      return
    }

    for (const vehicleId of createdVehicleIdsRef.current) {
      fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => undefined)
    }

    for (const customerId of createdCustomerIdsRef.current) {
      fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => undefined)
    }
  }
  
  const handleCancel = async () => {
    console.log("Cancel button clicked")
    if (hasChanges) {
      if (window.confirm("You have unsaved changes. Are you sure you want to discard them and go back?")) {
        toast.warning("Changes discarded")
        await rollbackCreatedRecords()

        // Clear form and state
        setFormData({
          mobileNo: "",
          customerName: "",
          customerId: "",
          registrationNumber: "",
          vehicleId: "",
          vehicleModel: "",
          vehicleMake: "",
          vehicleYear: "",
          vehicleColor: "",
          jobCardNumber: "",
          date: getTodayISODateInIndia(),
          fileNo: "",
          kmDriven: "",
          jobcardStatus: "Under Service",
        })
        setHasChanges(false)
        setCustomers([])
        setVehicles([])
        setVehicleMake("")
        setVehicleModelName("")
        console.log("Form cleared, navigating to home...")
        // Navigate after a small delay to ensure state updates
        setTimeout(() => {
          router.push("/")
        }, 100)
      }
    } else {
      // No unsaved changes, just navigate
      await rollbackCreatedRecords()
      router.push("/")
    }
  }
  
  const [formData, setFormData] = useState<FormData>({
    mobileNo: "",
    customerName: "",
    customerId: "",
    registrationNumber: "",
    vehicleId: "",
    vehicleModel: "",
    vehicleMake: "",
    vehicleYear: "",
    vehicleColor: "",
    jobCardNumber: "",
    date: getTodayISODateInIndia(),
    fileNo: "",
    kmDriven: "",
    jobcardStatus: "Under Service",
  })

  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [makesFromAPI, setMakesFromAPI] = useState<string[]>([])
  const [modelsForMake, setModelsForMake] = useState<string[]>([])
  const [modalsModelsForMake, setModalsModelsForMake] = useState<string[]>([])
  const [isLoadingMakes, setIsLoadingMakes] = useState(true)
  // Separate entity state as required
  const [vehicleObj, setVehicleObj] = useState<Vehicle | null>(null)
  const [customerObj, setCustomerObj] = useState<Customer | null>(null)
  const [isLoadingVehicleLookup, setIsLoadingVehicleLookup] = useState(false)
  const [showCustomers, setShowCustomers] = useState(false)
  const [showVehicles, setShowVehicles] = useState(false)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [vehicleHighlightedIndex, setVehicleHighlightedIndex] = useState(-1)
  const [makeHighlightedIndex, setMakeHighlightedIndex] = useState(-1)
  const [modelHighlightedIndex, setModelHighlightedIndex] = useState(-1)

  // Modal states
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false)
  const [addVehicleModalOpen, setAddVehicleModalOpen] = useState(false)
  const [addVehicleCustomerModalOpen, setAddVehicleCustomerModalOpen] = useState(false)
  const [vehicleNotFoundConfirm, setVehicleNotFoundConfirm] = useState(false)
  const [openVehicleAfterCustomerCreate, setOpenVehicleAfterCustomerCreate] = useState(false)
  const [customerNotFoundAlert, setCustomerNotFoundAlert] = useState(false)
  const [noVehiclesAlert, setNoVehiclesAlert] = useState(false)
  const [activeJobcardAlert, setActiveJobcardAlert] = useState(false)
  const [activeJobcardAlertMessage, setActiveJobcardAlertMessage] = useState(
    "This vehicle is already under service"
  )
  const [modalRegistrationNumber, setModalRegistrationNumber] = useState("")
  const [modalMobileInput, setModalMobileInput] = useState("")
  const [modalCustomerName, setModalCustomerName] = useState("")
  const [modalCustomerId, setModalCustomerId] = useState<string | null>(null)
  const [modalCustomerResults, setModalCustomerResults] = useState<Customer[]>([])
  const [modalCustomersOpen, setModalCustomersOpen] = useState(false)
  const [modalCustomerLoading, setModalCustomerLoading] = useState(false)
  const [modalCustomerHighlightedIndex, setModalCustomerHighlightedIndex] = useState(-1)
  const [modalVehicleMake, setModalVehicleMake] = useState("")
  const [modalVehicleModelName, setModalVehicleModelName] = useState("")
  const [modalVehicleYear, setModalVehicleYear] = useState(new Date().getFullYear().toString())
  const [modalVehicleColor, setModalVehicleColor] = useState("")
  const [modalMakeHighlightedIndex, setModalMakeHighlightedIndex] = useState(-1)
  const [modalModelHighlightedIndex, setModalModelHighlightedIndex] = useState(-1)
  const [modalMakesOpen, setModalMakesOpen] = useState(false)
  const [modalModelsOpen, setModalModelsOpen] = useState(false)
  const [showMakeDropdown, setShowMakeDropdown] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)

  // Unsaved changes
  const [hasChanges, setHasChanges] = useState(false)
  const initialFormRef = useRef<FormData>(JSON.parse(JSON.stringify(formData)))

  // Debounce timer for customer search
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const customerFetchToastRef = useRef<number>(0)
  const fetchCustomersBySearch = async (search: string): Promise<Customer[]> => {
    try {
      const response = await fetch(`/api/customers?search=${encodeURIComponent(search)}`)
      const data = await response.json().catch(() => [])

      if (!response.ok) {
        console.warn("Customer fetch returned non-OK status", response.status, data)
        return []
      }

      return Array.isArray(data) ? data : []
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return []
      }

      const now = Date.now()
      if (now - customerFetchToastRef.current > 1500) {
        toast.error("Unable to fetch customers. Check connection and try again")
        customerFetchToastRef.current = now
      }

      console.warn("Customer fetch failed", error)
      return []
    }
  }

  const isValidMobileNumber = (mobileNo: string) =>
    MOBILE_NUMBER_REGEX.test(mobileNo.trim())

  const isMobileNumberValid = isValidMobileNumber(formData.mobileNo)

  const showInvalidMobileToast = (mobileNo: string) => {
    const trimmedValue = mobileNo.trim()
    const now = Date.now()
    const isDuplicateValue = mobileValidationToastRef.current.value === trimmedValue
    const isWithinThrottleWindow = now - mobileValidationToastRef.current.timestamp < 900

    if (isDuplicateValue && isWithinThrottleWindow) {
      return
    }

    mobileValidationToastRef.current = {
      value: trimmedValue,
      timestamp: now,
    }
    
    if (!trimmedValue) {
      toast.error("Mobile number is required")
    } else if (trimmedValue.length < 10) {
      toast.error("Mobile number must be exactly 10 digits")
    } else if (trimmedValue.length > 10) {
      toast.error("Mobile number must be exactly 10 digits")
    } else {
      toast.error("Enter valid mobile number")
    }
  }

  const validateMobileNumberOrToast = (mobileNo: string) => {
    if (!mobileNo.trim()) {
      showInvalidMobileToast(mobileNo)
      return false
    }

    if (!isValidMobileNumber(mobileNo)) {
      showInvalidMobileToast(mobileNo)
      return false
    }

    return true
  }

  // Detect unsaved changes
  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify(initialFormRef.current)
    setHasChanges(changed)
  }, [formData])

  // Fetch vehicle makes from API on mount
  useEffect(() => {
    const loadMakes = async () => {
      setIsLoadingMakes(true)
      try {
        const makes = await fetchMakesFromAPI()
        setMakesFromAPI(makes)
      } finally {
        setIsLoadingMakes(false)
      }
    }
    loadMakes()
  }, [])

  // Fetch models when make changes in main form
  useEffect(() => {
    if (vehicleMake) {
      const loadModels = async () => {
        const models = await fetchModelsFromAPI(vehicleMake)
        setModelsForMake(models)
      }
      loadModels()
    } else {
      setModelsForMake([])
    }
  }, [vehicleMake])

  // Fetch models when modal make changes
  useEffect(() => {
    if (modalVehicleMake) {
      const loadModels = async () => {
        const models = await fetchModelsFromAPI(modalVehicleMake)
        setModalsModelsForMake(models)
      }
      loadModels()
    } else {
      setModalsModelsForMake([])
    }
  }, [modalVehicleMake])

  // Warn on page unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      rollbackCreatedRecordsOnUnload()

      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ""
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      rollbackCreatedRecordsOnUnload()
    }
  }, [hasChanges])

  // Fetch customers based on mobile number search
  const handleMobileNumberChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData((prev) => ({
      ...prev,
      mobileNo: value,
      customerName: "",
      customerId: "",
      registrationNumber: "",
      vehicleId: "",
      vehicleModel: "",
      vehicleMake: "",
      vehicleYear: "",
      vehicleColor: "",
    }))
    setCustomerObj(null)
    setVehicleObj(null)
    setVehicles([])
    setShowVehicles(false)
    setCustomerNotFoundAlert(false)
    setNoVehiclesAlert(false)
    setAddCustomerModalOpen(false)
    setAddVehicleModalOpen(false)

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (value.length < 3) {
      setCustomers([])
      setShowCustomers(false)
      setIsLoadingCustomers(false)
      return
    }

    setIsLoadingCustomers(true)
    setShowCustomers(true)

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await fetchCustomersBySearch(value)
        const exactMatch = data.find((customer) => customer.mobileNo === value)

        if (exactMatch) {
          setCustomers(data)
          return
        }

        setCustomers(data)
      } finally {
        setIsLoadingCustomers(false)
      }
    }, 300)
  }

  const handleMobileNumberKeyUp = (_e: React.KeyboardEvent<HTMLInputElement>) => {
    // Skip per-keystroke validation; we only validate on blur/submit to avoid early toasts.
  }

  // Vehicle make/model helpers
  const makeOptions = useMemo(() => getMakes(), [])
  const filteredMakes = useMemo(
    () => makeOptions.filter((m) => m.toLowerCase().includes(vehicleMake.toLowerCase())).slice(0, 12),
    [makeOptions, vehicleMake],
  )

  const modelOptions = useMemo(() => getModels(vehicleMake), [vehicleMake])
  const filteredModels = useMemo(
    () => modelOptions.filter((m) => m.toLowerCase().includes(vehicleModelName.toLowerCase())).slice(0, 12),
    [modelOptions, vehicleModelName],
  )

  const filteredModalMakes = useMemo(
    () => makeOptions.filter((m) => m.toLowerCase().includes(modalVehicleMake.toLowerCase())).slice(0, 12),
    [makeOptions, modalVehicleMake],
  )

  const modalModelOptions = useMemo(() => getModels(modalVehicleMake), [modalVehicleMake])
  const filteredModalModels = useMemo(
    () => modalModelOptions.filter((m) => m.toLowerCase().includes(modalVehicleModelName.toLowerCase())).slice(0, 12),
    [modalModelOptions, modalVehicleModelName],
  )

  const handleMakeInput = (value: string) => {
    const make = value.trim()
    setVehicleMake(make)
    setVehicleModelName("")
    setFormData((prev) => ({
      ...prev,
      vehicleMake: make,
      vehicleModel: make && vehicleModelName ? `${make} ${vehicleModelName}` : "",
    }))
  }

  const handleModelInput = (value: string) => {
    const model = value.trim()
    setVehicleModelName(model)
    setFormData((prev) => ({
      ...prev,
      vehicleMake: vehicleMake,
      vehicleModel: vehicleMake ? `${vehicleMake} ${model}` : model,
    }))
    if (vehicleMake && model) {
      addMakeModel(vehicleMake, model)
    }
  }

  const resetAddVehicleCustomerModalState = () => {
    setModalRegistrationNumber("")
    setModalMobileInput("")
    setModalCustomerName("")
    setModalCustomerId(null)
    setModalCustomerResults([])
    setModalCustomersOpen(false)
    setModalCustomerHighlightedIndex(-1)
    setModalCustomerLoading(false)
    setModalVehicleMake("")
    setModalVehicleModelName("")
    setModalVehicleYear(new Date().getFullYear().toString())
    setModalVehicleColor("")
    setModalMakeHighlightedIndex(-1)
    setModalModelHighlightedIndex(-1)
    setModalMakesOpen(false)
    setModalModelsOpen(false)
    if (modalCustomerDebounceRef.current) {
      clearTimeout(modalCustomerDebounceRef.current)
    }
  }

  const openAddVehicleCustomerModal = (registration: string) => {
    const normalized = normalizeRegistration(registration)
    setModalRegistrationNumber(normalized)
    setModalMobileInput("")
    setModalCustomerName("")
    setModalCustomerId(null)
    setModalVehicleMake("")
    setModalVehicleModelName("")
    setModalVehicleYear(new Date().getFullYear().toString())
    setModalVehicleColor("")
    setModalCustomersOpen(false)
    setModalCustomerResults([])
    setModalCustomerHighlightedIndex(-1)
    // ensure simple vehicle modal is closed so combined modal shows
    setAddVehicleModalOpen(false)
    setAddVehicleCustomerModalOpen(true)
  }

  const handleModalMobileChange = (value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 10)
    setModalMobileInput(sanitized)
    setModalCustomerId(null)
    setModalCustomerName("")
    setModalCustomerResults([])
    setModalCustomersOpen(false)
    setModalCustomerHighlightedIndex(-1)

    if (modalCustomerDebounceRef.current) {
      clearTimeout(modalCustomerDebounceRef.current)
    }

    if (sanitized.length < 3) {
      setModalCustomerLoading(false)
      return
    }

    setModalCustomerLoading(true)
    modalCustomerDebounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchCustomersBySearch(sanitized)
        setModalCustomerResults(data)
        setModalCustomersOpen(data.length > 0)
        setModalCustomerHighlightedIndex(data.length > 0 ? 0 : -1)
      } finally {
        setModalCustomerLoading(false)
      }
    }, 250)
  }

  const handleModalCustomerSelect = (customer: Customer) => {
    setModalCustomerId(customer.id)
    setModalMobileInput(customer.mobileNo)
    setModalCustomerName(customer.name)
    setModalCustomersOpen(false)
    setModalCustomerHighlightedIndex(-1)
  }

  const handleModalMobileKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setModalCustomersOpen(modalCustomerResults.length > 0)
      setModalCustomerHighlightedIndex((prev) => {
        if (modalCustomerResults.length === 0) return -1
        const maxIndex = modalCustomerResults.length - 1
        const next = prev < 0 ? 0 : Math.min(prev + 1, maxIndex)
        return next
      })
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      setModalCustomerHighlightedIndex((prev) => {
        if (modalCustomerResults.length === 0) return -1
        if (prev <= 0) return 0
        return prev - 1
      })
    }

    if (e.key === "Enter") {
      if (modalCustomerHighlightedIndex >= 0 && modalCustomerResults[modalCustomerHighlightedIndex]) {
        e.preventDefault()
        handleModalCustomerSelect(modalCustomerResults[modalCustomerHighlightedIndex])
      }
    }
  }

  // Handle customer selection
  const handleCustomerSelect = (customer: Customer) => {
    setFormData((prev) => ({
      ...prev,
      mobileNo: customer.mobileNo,
      customerName: customer.name,
      customerId: customer.id,
      registrationNumber: "",
      vehicleId: "",
      vehicleModel: "",
      vehicleMake: "",
      vehicleYear: "",
      vehicleColor: "",
    }))
    setCustomerObj(customer)
    setVehicleMake("")
    setVehicleModelName("")
    setVehicles([])
    setShowCustomers(false)
    fetchVehicles(customer.id)
  }

  // Handle "create customer" action when not found
  const handleCreateCustomer = () => {
    const mobileNo = formData.mobileNo.trim()

    if (!validateMobileNumberOrToast(mobileNo)) {
      return
    }

    setCustomerNotFoundAlert(false)
    setNoVehiclesAlert(false)
    setAddVehicleModalOpen(false)
    setShowCustomers(false)
    setAddCustomerModalOpen(true)
  }

  const clearFormContents = () => {
    setFormData({
      mobileNo: "",
      customerName: "",
      customerId: "",
      registrationNumber: "",
      vehicleId: "",
      vehicleModel: "",
      vehicleMake: "",
      vehicleYear: "",
      vehicleColor: "",
      jobCardNumber: "",
      date: getTodayISODateInIndia(),
      fileNo: "",
      kmDriven: "",
      jobcardStatus: "Under Service",
    })
    setVehicleMake("")
    setVehicleModelName("")
    setCustomers([])
    setVehicles([])
    setShowCustomers(false)
    setShowVehicles(false)
    setCustomerNotFoundAlert(false)
    setNoVehiclesAlert(false)
    setAddCustomerModalOpen(false)
    setAddVehicleModalOpen(false)
  }

  const checkActiveJobcardForVehicle = async (vehicleId: string) => {
    try {
      const response = await fetch(`/api/jobcards/active?vehicleId=${encodeURIComponent(vehicleId)}`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        return { exists: false as const }
      }

      return {
        exists: Boolean(data.exists),
        jobCardNumber: data?.jobCard?.jobCardNumber || "",
      }
    } catch {
      return { exists: false as const }
    }
  }

  // Fetch vehicles for selected customer
  const fetchVehicles = async (customerId: string): Promise<Vehicle[]> => {
    try {
      setIsLoadingVehicles(true)
      const response = await fetch(`/api/vehicles?customerId=${customerId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch vehicles")
      }

      const safeVehicles = Array.isArray(data) ? data : []
      setVehicles(safeVehicles)
      return safeVehicles
    } catch (error) {
      console.error("Error fetching vehicles:", error)
      toast.error("Failed to fetch vehicles")
      setVehicles([])
      return []
    } finally {
      setIsLoadingVehicles(false)
    }
  }

  const focusRegistrationInput = () => {
    requestAnimationFrame(() => {
      registrationInputRef.current?.focus()
    })
  }

  const openVehicleSelection = async (customerId: string, forceFetch = false) => {
    const customerVehicles =
      !forceFetch && vehicles.length > 0 ? vehicles : await fetchVehicles(customerId)

    if (customerVehicles.length === 0) {
      setShowVehicles(false)
      setNoVehiclesAlert(true)
      return
    }

    setShowVehicles(true)
  }

  // Handle vehicle selection
  const handleVehicleSelect = async (vehicle: Vehicle) => {
    const activeCheck = await checkActiveJobcardForVehicle(vehicle.id)

    if (activeCheck.exists) {
      setShowVehicles(false)
      setActiveJobcardAlertMessage(
        activeCheck.jobCardNumber
          ? `This vehicle is already under service in JobCard ${activeCheck.jobCardNumber}`
          : "This vehicle is already under service"
      )
      setActiveJobcardAlert(true)
      clearFormContents()
      fetchNextJobCardNumber()
      return
    }

    setFormData((prev) => ({
      ...prev,
      registrationNumber: vehicle.registrationNumber,
      vehicleId: vehicle.id,
      vehicleModel: `${vehicle.make} ${vehicle.model}`,
      vehicleMake: vehicle.make || "",
      vehicleYear: vehicle.year ? String(vehicle.year) : "",
      vehicleColor: vehicle.color || "",
    }))
    // set separate vehicle state
    setVehicleObj(vehicle)
    setVehicleMake(vehicle.make || "")
    setVehicleModelName(vehicle.model || "")
    setShowVehicles(false)
    // If this vehicle has a lastCustomer and we don't have a customer selected, fetch and set it
    if (!customerObj && (vehicle as any).lastCustomerId) {
      try {
        const resp = await fetch(`/api/customers/${encodeURIComponent((vehicle as any).lastCustomerId)}`)
        if (resp.ok) {
          const cust = await resp.json()
          if (cust && cust.id) {
            setCustomerObj(cust)
            setFormData((prev) => ({
              ...prev,
              mobileNo: cust.mobileNo || "",
              customerName: cust.name || "",
              customerId: cust.id,
            }))
          }
        }
      } catch (err) {
        console.warn("Failed to fetch vehicle.lastCustomerId", err)
      }
    }
    fetchNextJobCardNumber(vehicle.id)
  }

  

  // Global keyboard fallback: capture arrow/enter/escape even if input doesn't receive events
  const filteredVehicles = useMemo(() => {
    const query = normalizeRegistration(formData.registrationNumber)

    if (!query) {
      return [...vehicles]
    }

    const scoredVehicles = vehicles
      .map((vehicle) => {
        const registration = normalizeRegistration(vehicle.registrationNumber)

        const score = getRegistrationMatchScore(registration, query)

        return { vehicle, score }
      })
      .filter((item) => item.score >= 0)
      .sort((a, b) => {
        if (a.score !== b.score) {
          return a.score - b.score
        }
        return a.vehicle.registrationNumber.localeCompare(b.vehicle.registrationNumber)
      })

    return scoredVehicles.map((item) => item.vehicle)
  }, [formData.registrationNumber, vehicles])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!showVehicles) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setVehicleHighlightedIndex((prev) => {
          const next = prev < filteredVehicles.length - 1 ? prev + 1 : 0
          return next
        })
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setVehicleHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : Math.max(0, filteredVehicles.length - 1)
          return next
        })
        return
      }

      if (e.key === 'Enter') {
        if (vehicleHighlightedIndex >= 0 && filteredVehicles[vehicleHighlightedIndex]) {
          e.preventDefault()
          // call selection
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          handleVehicleSelect(filteredVehicles[vehicleHighlightedIndex])
        }
        return
      }

      if (e.key === 'Escape') {
        setShowVehicles(false)
        setVehicleHighlightedIndex(-1)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showVehicles, filteredVehicles, vehicleHighlightedIndex])

  // Lookup vehicle by registration on blur (vehicle-first flow)
  const fetchVehicleByRegistration = async (registration: string) => {
    const normalized = normalizeRegistration(registration)
    if (!normalized) return null

    try {
      setIsLoadingVehicleLookup(true)
      // use exact lookup endpoint which returns a single vehicle object
      const response = await fetch(`/api/vehicles/by-registration?registration=${encodeURIComponent(normalized)}`)
      if (!response.ok) {
        return null
      }
      const data = await response.json()
      return data || null
    } catch (error) {
      console.error("Vehicle lookup failed", error)
      return null
    } finally {
      setIsLoadingVehicleLookup(false)
    }
  }

  const handleRegistrationBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const reg = e.currentTarget.value.trim()
    if (!reg) return

    const existing = await fetchVehicleByRegistration(reg)

    if (existing && existing.id) {
      // autofill vehicle and attempt to load lastCustomer
      setVehicleObj(existing)
      setFormData((prev) => ({
        ...prev,
        registrationNumber: existing.registrationNumber,
        vehicleId: existing.id,
        vehicleModel: `${existing.make} ${existing.model}`,
        vehicleMake: existing.make || "",
              vehicleYear: existing.year ? String(existing.year) : "",
              vehicleColor: (existing as any).color || "",
      }))

      // load last customer if present
      if (existing.lastCustomerId) {
        try {
          const resp = await fetch(`/api/customers/${encodeURIComponent(existing.lastCustomerId)}`)
          if (resp.ok) {
            const cust = await resp.json()
            if (cust && cust.id) {
              setCustomerObj(cust)
              setFormData((prev) => ({
                ...prev,
                mobileNo: cust.mobileNo || "",
                customerName: cust.name || "",
                customerId: cust.id,
              }))
            }
          }
        } catch (err) {
          console.warn("Failed to fetch lastCustomer", err)
        }
      }

      // fetch next jobcard number for vehicle
      fetchNextJobCardNumber(existing.id)
      return
    }

    // vehicle not found → open combined add modal
    openAddVehicleCustomerModal(reg)
  }

  const handleRegistrationNumberChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value.toUpperCase()

    setFormData((prev) => ({
      ...prev,
      registrationNumber: value,
      vehicleId: "",
      vehicleModel: "",
      vehicleMake: "",
      vehicleYear: "",
      vehicleColor: "",
    }))
    const query = normalizeRegistration(value)

    // If we have a customer selected, fetch their vehicles as before
    if (formData.customerId) {
      if (vehicles.length === 0) {
        const customerVehicles = await fetchVehicles(formData.customerId)

        if (customerVehicles.length === 0) {
          setShowVehicles(false)
          setNoVehiclesAlert(true)
          return
        }
      }

      setShowVehicles(true)
      return
    }

    // No customer selected: try a global registration search for suggestions
    if (query) {
      try {
        const resp = await fetch(`/api/vehicles?registration=${encodeURIComponent(query)}`)
        if (resp.ok) {
          const list = await resp.json()
          setVehicles(Array.isArray(list) ? list : [])
          // reset highlighted index when suggestions change
          setVehicleHighlightedIndex(list && Array.isArray(list) && list.length > 0 ? 0 : -1)
          setShowVehicles(true)
          return
        }
      } catch (err) {
        console.warn("Global vehicle search failed", err)
      }
    }

    setShowVehicles(false)
  }

  // Fetch next jobcard number
  const fetchNextJobCardNumber = async (vehicleId?: string) => {
    try {
      const response = await fetch(`/api/jobcards/next-number?shopCode=${SHOP_CODE}&year=${new Date().getFullYear()}`)
      const data = await response.json()
      setFormData((prev) => ({
        ...prev,
        jobCardNumber: data.jobCardNumber,
      }))
    } catch (error) {
      console.error("Error fetching jobcard number:", error)
      toast.error("Failed to generate jobcard number")
    }
  }

  // Initialize jobcard number on mount
  useEffect(() => {
    fetchNextJobCardNumber()
  }, [])

  // Initialize keyboard navigation
  useEffect(() => {
    const formContainer = document.querySelector('form') || document.body
    if (formContainer) {
      setupFormKeyboardNavigation(formContainer as HTMLElement)
    }
  }, [])

  // Handle mobile number blur (check if customer needs to be created)
  const handleMobileNumberBlur = async (
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    const mobileNo = e.currentTarget.value.trim()

    if (!mobileNo || formData.customerId) {
      return
    }

    if (!validateMobileNumberOrToast(mobileNo)) {
      return
    }

    // Search for customer
    try {
      const data = await fetchCustomersBySearch(mobileNo)

      if (data.length === 0) {
        setShowCustomers(false)
        setNoVehiclesAlert(false)
        setAddVehicleModalOpen(false)
        setCustomerNotFoundAlert(true)
        return
      }

      const exactMatch = data.find((c) => c.mobileNo === mobileNo)
      if (exactMatch) {
        setCustomerObj(exactMatch)
        setFormData((prev) => ({
          ...prev,
          mobileNo: exactMatch.mobileNo,
          customerName: exactMatch.name,
          customerId: exactMatch.id,
        }))
      }
    } catch (error) {
      console.error("Error checking customer:", error)
    }
  }

  const handleMobileNumberKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key !== "Enter" && e.key !== "Tab") {
      return
    }

    const mobileNo = e.currentTarget.value.trim()

    if (!mobileNo) {
      return
    }

    if (!validateMobileNumberOrToast(mobileNo)) {
      e.preventDefault()
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
    }

    // If customer is already selected, directly open vehicle dropdown
    if (formData.customerId) {
      e.preventDefault()
      setShowCustomers(false)
      await openVehicleSelection(formData.customerId, true)
      focusRegistrationInput()
      return
    }

    try {
      const data = await fetchCustomersBySearch(mobileNo)
      const exactMatch = data.find((customer) => customer.mobileNo === mobileNo)

      if (exactMatch) {
        setFormData((prev) => ({
          ...prev,
          mobileNo: exactMatch.mobileNo,
          customerName: exactMatch.name,
          customerId: exactMatch.id,
          registrationNumber: "",
          vehicleId: "",
          vehicleModel: "",
          vehicleMake: "",
          vehicleYear: "",
          vehicleColor: "",
        }))
        setCustomerObj(exactMatch)
        setShowCustomers(false)
        e.preventDefault()
        await openVehicleSelection(exactMatch.id, true)
        focusRegistrationInput()
        return
      }

      if (data.length === 0 && mobileNo.length >= 10) {
        setShowCustomers(false)
        setNoVehiclesAlert(false)
        setAddVehicleModalOpen(false)
        setCustomerNotFoundAlert(true)
      }
    } catch (error) {
      console.error("Error resolving customer on key press:", error)
    }
  }

  const handleAddVehicleCustomerModalOpenChange = (isOpen: boolean) => {
    setAddVehicleCustomerModalOpen(isOpen)
    if (!isOpen) {
      resetAddVehicleCustomerModalState()
    }
  }

  useEffect(() => {
    if (!addVehicleCustomerModalOpen) {
      return
    }

    const focusTimer = window.setTimeout(() => {
      modalMobileInputRef.current?.focus()
      modalMobileInputRef.current?.select()
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
    }
  }, [addVehicleCustomerModalOpen])

  const handleAddVehicleCustomerSave = async () => {
    const registration = normalizeRegistration(
      modalRegistrationNumber || formData.registrationNumber
    )
    const mobileNo = modalMobileInput.trim()
    const name = (modalCustomerName || "").trim()
    const make = modalVehicleMake.trim()
    const modelName = modalVehicleModelName.trim()
    const yearValue = modalVehicleYear.trim()
    const colorValue = modalVehicleColor.trim()

    if (!registration) {
      toast.error("Enter registration number")
      return
    }

    if (!mobileNo) {
      toast.error("Enter customer mobile number")
      return
    }

    if (!validateMobileNumberOrToast(mobileNo)) {
      return
    }

    if (!make || !modelName) {
      toast.error("Vehicle make and model are required")
      return
    }

    if (yearValue && !/^\d{4}$/.test(yearValue)) {
      toast.error("Enter valid 4-digit year")
      return
    }

    if (!modalCustomerId && !name) {
      toast.error("Enter customer name")
      return
    }

    setModalSaving(true)
    try {
      let customerId = modalCustomerId
      let customerName = name

      if (!customerId) {
        const customerPayload = {
          mobileNo,
          name: toProperCase(name),
          email: "",
          address: "",
          city: "",
          state: "",
          pincode: "",
        }

        const resp = await fetch("/api/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(customerPayload),
        })

        const data = await resp.json().catch(() => ({}))

        if (!resp.ok) {
          throw new Error(data.error || "Failed to create customer")
        }

        customerId = data.id
        customerName = data.name || name
        if (customerId) {
          createdCustomerIdsRef.current.add(customerId)
        }
      }

      const vehiclePayload = {
        registrationNumber: toUpperCase(registration),
        make: toProperCase(make),
        model: toProperCase(modelName),
        year: yearValue || new Date().getFullYear().toString(),
        color: colorValue ? toProperCase(colorValue) : "",
        lastCustomerId: customerId,
        transferIfExists: false,
      }

      const vehicleResp = await fetch("/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vehiclePayload),
      })

      const vehicleData = await vehicleResp.json().catch(() => ({}))

      if (!vehicleResp.ok) {
        throw new Error(vehicleData.error || "Failed to create vehicle")
      }

      if (vehicleData?.id) {
        createdVehicleIdsRef.current.add(vehicleData.id)
      }

      const finalVehicleMake = vehicleData.make || toProperCase(make)
      const finalVehicleModel = vehicleData.model || toProperCase(modelName)
      const finalVehicleYear = vehicleData.year ? String(vehicleData.year) : (yearValue || "")
      const finalVehicleColor = vehicleData.color || colorValue || ""

      if (finalVehicleMake && finalVehicleModel) {
        addMakeModel(finalVehicleMake, finalVehicleModel)
      }

      setCustomerObj({
        id: customerId || "",
        mobileNo,
        name: customerName,
      })

      setVehicleObj(vehicleData)

      setFormData((prev) => ({
        ...prev,
        mobileNo,
        customerName: customerName || prev.customerName,
        customerId: customerId || prev.customerId,
        registrationNumber: vehicleData.registrationNumber || registration,
        vehicleId: vehicleData.id || prev.vehicleId,
        vehicleMake: finalVehicleMake,
        vehicleModel: `${finalVehicleMake} ${finalVehicleModel}`,
        vehicleYear: finalVehicleYear,
        vehicleColor: finalVehicleColor,
      }))

      setVehicleMake(finalVehicleMake)
      setVehicleModelName(finalVehicleModel)
      setFormData((prev) => ({ ...prev, vehicleYear: finalVehicleYear, vehicleColor: finalVehicleColor }))
      
      toast.success("Vehicle and customer saved successfully")
      
      setAddVehicleCustomerModalOpen(false)
      setShowVehicles(false)
      resetAddVehicleCustomerModalState()

      if (customerId) {
        fetchVehicles(customerId)
      }

      fetchNextJobCardNumber(vehicleData.id)
    } catch (error) {
      console.warn("Error creating vehicle/customer from modal:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setModalSaving(false)
    }
  }

  // Handle form submission
  const handleSave = async () => {
    try {
      // Validation
      if (!customerObj || !customerObj.mobileNo || !isValidMobileNumber(customerObj.mobileNo)) {
        toast.error("Enter valid mobile number for customer")
        return
      }

      if (!customerObj || !customerObj.id) {
        errorAction("Required fields are empty. Please select or create a Customer.")
        return
      }

      if (!vehicleObj || !vehicleObj.id) {
        errorAction("Required fields are empty. Please select or create a Vehicle.")
        return
      }

      setIsLoading(true)

      // Ask backend to create jobcard and update vehicle.lastCustomerId in a transaction
      const response = await fetch("/api/jobcards?updateVehicleLastCustomer=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobCardNumber: formData.jobCardNumber,
          shopCode: SHOP_CODE,
          customerId: customerObj.id,
          vehicleId: vehicleObj.id,
          serviceDate: formData.date,
          fileNo: formData.fileNo || null,
          kmDriven: formData.kmDriven || null,
          jobcardStatus: formData.jobcardStatus,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))

        if (response.status === 409 && error.code === "ACTIVE_JOBCARD_EXISTS") {
          setActiveJobcardAlertMessage(
            error.error || "This vehicle is already under service"
          )
          setActiveJobcardAlert(true)
          clearFormContents()
          fetchNextJobCardNumber()
          return
        }

        if (response.status === 409 && error.error) {
          // keep using sonner's toast.warning for less common variant
          toast.warning(error.error)
          return
        }

        errorAction(error.error || "Failed to create jobcard")
        return
      }

      toast.success("JobCard created successfully!")
      hasSavedJobcardRef.current = true
      createdVehicleIdsRef.current.clear()
      createdCustomerIdsRef.current.clear()
      initialFormRef.current = JSON.parse(JSON.stringify(formData))
      setHasChanges(false)

      // Reset form
      clearFormContents()

      // Fetch new jobcard number
      fetchNextJobCardNumber()
    } catch (error) {
      console.warn("Error creating jobcard:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to create jobcard"
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div>
        {/* Row 1: Registration Number, Vehicle Model, Jobcard Date */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 md:gap-4">
          {/* Column 1: Registration Number */}
          <div className="space-y-3">
            <div className="relative">
              <Label htmlFor="registrationNumber" className="mb-1 block text-sm">
                Registration Number
              </Label>
              <Input
                id="registrationNumber"
                name="registrationNumber"
                data-dropdown-trigger="true"
                data-dropdown-id="registration-dropdown"
                ref={registrationInputRef}
                value={formData.registrationNumber}
                onChange={handleRegistrationNumberChange}
                onBlur={handleRegistrationBlur}
                onFocus={async () => {
                  if (!formData.customerId) return
                  await openVehicleSelection(formData.customerId)
                  }}
                  onKeyDownCapture={(e) => {
                    // debug: log key events to help diagnose arrow navigation issues
                    console.log('registration onKeyDown', { key: e.key, showVehicles, filteredCount: filteredVehicles.length, highlighted: vehicleHighlightedIndex })
                      if (!showVehicles) return
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setVehicleHighlightedIndex((prev) => {
                          const next = prev < filteredVehicles.length - 1 ? prev + 1 : 0
                          return next
                        })
                        return
                      }

                      if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setVehicleHighlightedIndex((prev) => {
                          const next = prev > 0 ? prev - 1 : Math.max(0, filteredVehicles.length - 1)
                          return next
                        })
                        return
                      }

                      if (e.key === 'Enter') {
                        if (vehicleHighlightedIndex >= 0 && filteredVehicles[vehicleHighlightedIndex]) {
                          e.preventDefault()
                          handleVehicleSelect(filteredVehicles[vehicleHighlightedIndex])
                        }
                        return
                      }

                      if (e.key === 'Escape') {
                        setShowVehicles(false)
                        setVehicleHighlightedIndex(-1)
                      }
                  }}
                disabled={isLoading}
                className="h-10"
                autoComplete="off"
              />

              {showVehicles && (
                <div id="registration-dropdown" className="absolute top-full left-0 right-0 mt-1 z-50 dropdown-scroll">
                    {isLoadingVehicles ? (
                      <div className="dropdown-empty-state">Loading...</div>
                    ) : filteredVehicles.length > 0 ? (
                      <>
                            {filteredVehicles.map((vehicle, idx) => (
                              <button
                                key={vehicle.id}
                                type="button"
                                tabIndex={0}
                                // prevent input blur from firing before selection
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  setVehicleHighlightedIndex(idx)
                                  handleVehicleSelect(vehicle)
                                }}
                                className={`dropdown-item ${vehicleHighlightedIndex === idx ? 'selected' : ''}`}
                              >
                                <div className="font-medium">{vehicle.registrationNumber}</div>
                                <div className="text-xs text-muted-foreground">
                                  {[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                                </div>
                              </button>
                            ))}
                        <button
                          type="button"
                          tabIndex={0}
                          onMouseDown={(e) => { e.preventDefault(); setShowVehicles(false); openAddVehicleCustomerModal(formData.registrationNumber) }}
                          className="w-full px-3 py-2 text-left text-sm text-primary font-medium border-t"
                        >
                          + Add New Vehicle
                        </button>
                      </>
                    ) : (
                        <div className="p-3">
                        <button
                          type="button"
                          tabIndex={0}
                          onMouseDown={(e) => { e.preventDefault(); setShowVehicles(false); openAddVehicleCustomerModal(formData.registrationNumber) }}
                          className="w-full text-left text-sm text-primary font-medium"
                        >
                          + Add New Vehicle
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Vehicle Model (Combined Make + Model) */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="vehicleModelCombined" className="mb-1 block text-sm">Vehicle Model</Label>
              <Input 
                id="vehicleModelCombined" 
                value={formData.vehicleModel}
                placeholder="Select vehicle first" 
                disabled={true}
                className="h-10 bg-muted text-muted-foreground" 
              />
            </div>
          </div>

          {/* Column 3: Jobcard Date */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="date" className="mb-1 block text-sm">Jobcard Date</Label>
              <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData((p)=>({ ...p, date: e.target.value }))} disabled={!isMobileNumberValid || isLoading} className="h-10" autoComplete="off" />
            </div>
          </div>
        </div>

        {/* Row 2: File No, KM Driven, Jobcard Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div>
            <Label htmlFor="fileNo" className="mb-1 block text-sm">File No</Label>
            <Input id="fileNo" name="fileNo" value={formData.fileNo} onChange={(e)=> setFormData((p)=>({ ...p, fileNo: e.target.value }))} disabled={!isMobileNumberValid || isLoading} className="h-10" autoComplete="off" />
          </div>

          <div>
            <Label htmlFor="kmDriven" className="mb-1 block text-sm">KM Driven</Label>
            <Input id="kmDriven" type="number" value={formData.kmDriven} onChange={(e) => setFormData((p)=>({ ...p, kmDriven: e.target.value }))} disabled={!isMobileNumberValid || isLoading} className="h-10" autoComplete="off" />
          </div>

          <div>
            <Label htmlFor="status" className="mb-1 block text-sm">Jobcard Status</Label>
            <Select value={formData.jobcardStatus} onValueChange={(v)=> setFormData((p)=>({ ...p, jobcardStatus: v }))} disabled={!isMobileNumberValid || isLoading}>
              <SelectTrigger id="status" className="h-10"><SelectValue/></SelectTrigger>
              <SelectContent>{JOB_CARD_STATUSES.map((status)=> <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-5 pt-6">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            size="sm"
            onClick={handleCancel}
            className="min-w-20 bg-white hover:bg-gray-100 px-4 py-2 min-h-[40px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !vehicleObj || !customerObj}
            size="sm"
            className="min-w-24 bg-green-600 text-white hover:bg-green-700 px-4 py-2 min-h-[40px]"
          >
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <Dialog
        open={addVehicleCustomerModalOpen}
        onOpenChange={handleAddVehicleCustomerModalOpenChange}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Add New Vehicle & Customer</DialogTitle>
            <DialogDescription>
              Registration not found. Create a customer and link their vehicle.
            </DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-registration">Registration Number</Label>
              <Input
                id="modal-registration"
                value={modalRegistrationNumber}
                onChange={(e) => setModalRegistrationNumber(e.target.value.toUpperCase())}
                disabled={modalSaving}
                className="h-10"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="modal-mobile">Customer Mobile</Label>
              <Input
                ref={modalMobileInputRef}
                id="modal-mobile"
                value={modalMobileInput}
                onChange={(e) => handleModalMobileChange(e.target.value)}
                onKeyDown={handleModalMobileKeyDown}
                disabled={modalSaving}
                className="h-10"
                placeholder="Search or enter mobile"
                maxLength={10}
                autoComplete="off"
              />
              {modalCustomersOpen && modalCustomerResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 dropdown-scroll">
                    {modalCustomerResults.map((customer, idx) => (
                      <button
                        key={customer.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleModalCustomerSelect(customer)
                        }}
                        className={`dropdown-item ${modalCustomerHighlightedIndex === idx ? 'selected' : ''}`}
                      >
                        <div className="font-medium">{customer.mobileNo}</div>
                        <div className="text-xs text-muted-foreground">{customer.name}</div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-name">Customer Name</Label>
              <Input
                id="modal-name"
                value={modalCustomerName}
                onChange={(e) => {
                  setModalCustomerName(e.target.value)
                  if (modalCustomerId) {
                    setModalCustomerId(null)
                  }
                }}
                disabled={modalSaving}
                className="h-10"
                placeholder="Enter customer name"
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 items-start">
              <div className="space-y-2 relative">
                <Label htmlFor="modal-make">Vehicle Make</Label>
                <Input
                  id="modal-make"
                  name="vehicleMake"
                  value={modalVehicleMake}
                  onChange={(e) => {
                    const value = e.target.value
                    setModalVehicleMake(value)
                    setModalVehicleModelName("")
                    setModalModelsOpen(false)
                    setModalModelHighlightedIndex(-1)
                    if (makeOptions.length > 0) {
                      setModalMakesOpen(true)
                      setModalMakeHighlightedIndex(-1)
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (filteredModalMakes.length === 1) {
                        setModalVehicleMake(filteredModalMakes[0])
                        setModalVehicleModelName("")
                      }
                      setModalMakesOpen(false)
                      setModalMakeHighlightedIndex(-1)
                    }, 150)
                  }}
                  onFocus={() => {
                    if (makeOptions.length > 0) {
                      setModalMakesOpen(true)
                      setModalMakeHighlightedIndex(modalVehicleMake ? -1 : 0)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      setModalMakesOpen(false)
                      if (modalMakeHighlightedIndex >= 0 && filteredModalMakes[modalMakeHighlightedIndex]) {
                        setModalVehicleMake(filteredModalMakes[modalMakeHighlightedIndex])
                        setModalVehicleModelName("")
                      } else if (filteredModalMakes.length === 1) {
                        setModalVehicleMake(filteredModalMakes[0])
                        setModalVehicleModelName("")
                      }
                      setModalMakeHighlightedIndex(-1)
                      return
                    }
                    
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      if (filteredModalMakes.length > 0) {
                        setModalMakesOpen(true)
                        setModalMakeHighlightedIndex((prev) => {
                          if (prev < 0) return 0
                          return prev < filteredModalMakes.length - 1 ? prev + 1 : 0
                        })
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      if (filteredModalMakes.length > 0) {
                        setModalMakesOpen(true)
                        setModalMakeHighlightedIndex((prev) => {
                          if (prev < 0) return filteredModalMakes.length - 1
                          return prev > 0 ? prev - 1 : filteredModalMakes.length - 1
                        })
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      const selectedMake =
                        modalMakeHighlightedIndex >= 0 && filteredModalMakes[modalMakeHighlightedIndex]
                          ? filteredModalMakes[modalMakeHighlightedIndex]
                          : filteredModalMakes.length === 1
                            ? filteredModalMakes[0]
                            : ""

                      if (selectedMake) {
                        setModalVehicleMake(selectedMake)
                        setModalVehicleModelName("")
                        setModalMakesOpen(false)
                        setModalMakeHighlightedIndex(-1)
                        // Focus model field after selecting make
                        setTimeout(() => {
                          document.getElementById('modal-model')?.focus()
                        }, 100)
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setModalMakesOpen(false)
                      setModalMakeHighlightedIndex(-1)
                    }
                  }}
                  disabled={modalSaving}
                  className="h-10"
                  placeholder="Start typing make"
                  autoComplete="off"
                />
                {filteredModalMakes.length > 0 && modalMakesOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 dropdown-scroll">
                    {filteredModalMakes.map((make, idx) => (
                      <button
                        key={make}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setModalVehicleMake(make)
                          setModalVehicleModelName("")
                          setModalMakesOpen(false)
                          setModalMakeHighlightedIndex(-1)
                          // Focus model field after selecting make
                          setTimeout(() => {
                            document.getElementById('modal-model')?.focus()
                          }, 100)
                        }}
                        className={`dropdown-item ${modalMakeHighlightedIndex === idx ? 'selected' : ''}`}
                      >
                        {make}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 relative">
                <Label htmlFor="modal-model">Vehicle Model</Label>
                <Input
                  id="modal-model"
                  name="vehicleModel"
                  value={modalVehicleModelName}
                  onChange={(e) => {
                    const value = e.target.value
                    setModalVehicleModelName(value)
                    if (modalVehicleMake && modalModelOptions.length > 0) {
                      setModalModelsOpen(true)
                      setModalModelHighlightedIndex(-1)
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (filteredModalModels.length === 1) {
                        setModalVehicleModelName(filteredModalModels[0])
                      }
                      setModalModelsOpen(false)
                      setModalModelHighlightedIndex(-1)
                    }, 150)
                  }}
                  onFocus={() => {
                    // Always show dropdown when focused if make is selected
                    if (modalVehicleMake) {
                      setModalModelsOpen(true)
                      setModalModelHighlightedIndex(modalVehicleModelName ? -1 : 0)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      setModalModelsOpen(false)
                      if (modalModelHighlightedIndex >= 0 && filteredModalModels[modalModelHighlightedIndex]) {
                        setModalVehicleModelName(filteredModalModels[modalModelHighlightedIndex])
                      } else if (filteredModalModels.length === 1) {
                        setModalVehicleModelName(filteredModalModels[0])
                      }
                      setModalModelHighlightedIndex(-1)
                      return
                    }
                    
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      if (filteredModalModels.length > 0) {
                        setModalModelsOpen(true)
                        setModalModelHighlightedIndex((prev) => {
                          if (prev < 0) return 0
                          return prev < filteredModalModels.length - 1 ? prev + 1 : 0
                        })
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      if (filteredModalModels.length > 0) {
                        setModalModelsOpen(true)
                        setModalModelHighlightedIndex((prev) => {
                          if (prev < 0) return filteredModalModels.length - 1
                          return prev > 0 ? prev - 1 : filteredModalModels.length - 1
                        })
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      const selectedModel =
                        modalModelHighlightedIndex >= 0 && filteredModalModels[modalModelHighlightedIndex]
                          ? filteredModalModels[modalModelHighlightedIndex]
                          : filteredModalModels.length === 1
                            ? filteredModalModels[0]
                            : ""

                      if (selectedModel) {
                        setModalVehicleModelName(selectedModel)
                        setModalModelsOpen(false)
                        setModalModelHighlightedIndex(-1)
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setModalModelsOpen(false)
                      setModalModelHighlightedIndex(-1)
                    }
                  }}
                  disabled={modalSaving || !modalVehicleMake}
                  className="h-10"
                  placeholder={modalVehicleMake ? "Start typing model" : "Pick a make first"}
                  autoComplete="off"
                />
                {modalModelsOpen && modalVehicleMake && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 dropdown-scroll">
                    {filteredModalModels.length > 0 ? (
                      filteredModalModels.map((model, idx) => (
                        <button
                          key={model}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setModalVehicleModelName(model)
                            setModalModelsOpen(false)
                            setModalModelHighlightedIndex(-1)
                          }}
                          className={`dropdown-item ${modalModelHighlightedIndex === idx ? 'selected' : ''}`}
                        >
                          {model}
                        </button>
                      ))
                    ) : (
                      <div className="dropdown-empty-state">
                        {modalModelOptions.length === 0 ? 'No models found for this make' : 'No matching models'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-year">Year</Label>
                <Input
                  id="modal-year"
                  type="number"
                  value={modalVehicleYear}
                  onChange={(e) => setModalVehicleYear(e.target.value)}
                  disabled={modalSaving}
                  className="h-10"
                  placeholder="e.g. 2024"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-color">Color</Label>
                <Input
                  id="modal-color"
                  value={modalVehicleColor}
                  onChange={(e) => setModalVehicleColor(e.target.value)}
                  disabled={modalSaving}
                  className="h-10"
                  placeholder="e.g. White"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-5 justify-end">
            <Button
              variant="outline"
              onClick={() => handleAddVehicleCustomerModalOpenChange(false)}
              disabled={modalSaving}
              className="px-4 py-2 min-h-[40px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddVehicleCustomerSave}
              disabled={modalSaving}
              className="px-4 py-2 min-h-[40px] bg-blue-600 text-white hover:bg-blue-700"
            >
              {modalSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <AddCustomerModal
        open={addCustomerModalOpen}
        mobileNumber={formData.mobileNo}
        onOpenChange={setAddCustomerModalOpen}
        onCustomerAdded={async (customer) => {
          console.log("AddCustomerModal -> onCustomerAdded payload:", customer)
          createdCustomerIdsRef.current.add(customer.id)
          setFormData((prev) => ({
            ...prev,
            mobileNo: customer.mobileNo,
            customerName: customer.name,
            customerId: customer.id,
            registrationNumber: "",
            vehicleId: "",
            vehicleModel: "",
            vehicleMake: "",
            vehicleYear: "",
            vehicleColor: "",
          }))
          setCustomerObj(customer)
          setShowCustomers(false)
          setCustomerNotFoundAlert(false)
          setNoVehiclesAlert(false)
          setAddCustomerModalOpen(false)

          // If flow requested opening vehicle modal after creating customer, do it now
          if (openVehicleAfterCustomerCreate) {
            setOpenVehicleAfterCustomerCreate(false)
            // make sure combined add-customer+vehicle modal is closed
            setAddVehicleCustomerModalOpen(false)
            setAddVehicleModalOpen(true)
          }

          const customerVehicles = await fetchVehicles(customer.id)
          if (customerVehicles.length === 0) {
            setNoVehiclesAlert(true)
          }
        }}
      />

      <AddVehicleModal
        open={addVehicleModalOpen}
        customerId={formData.customerId}
        initialRegistration={formData.registrationNumber}
        initialMake={vehicleMake}
        initialModel={vehicleModelName}
        initialYear={formData.vehicleYear}
        initialColor={formData.vehicleColor}
        onOpenChange={setAddVehicleModalOpen}
        onVehicleAdded={(vehicle) => {
          if (!vehicle?.transferred && vehicle?.id) {
            createdVehicleIdsRef.current.add(vehicle.id)
          }

          if (vehicle && vehicle.id) {
            setVehicleObj(vehicle)
            // update form to reflect created vehicle
            setFormData((prev) => ({
              ...prev,
              registrationNumber: vehicle.registrationNumber,
              vehicleId: vehicle.id,
              vehicleMake: vehicle.make || "",
              vehicleModel: `${vehicle.make} ${vehicle.model}`,
              vehicleYear: vehicle.year ? String(vehicle.year) : "",
              vehicleColor: (vehicle as any).color || "",
            }))
          }

          fetchVehicles(formData.customerId)
          handleVehicleSelect(vehicle)
          setAddVehicleModalOpen(false)
        }}
      />

      <AlertDialog open={vehicleNotFoundConfirm} onOpenChange={setVehicleNotFoundConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vehicle Not Found</AlertDialogTitle>
            <AlertDialogDescription>
              Vehicle not found. Add new vehicle?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setVehicleNotFoundConfirm(false)
              // If no customer selected, open customer modal first then vehicle
              if (!formData.customerId) {
                setOpenVehicleAfterCustomerCreate(true)
                setAddCustomerModalOpen(true)
                return
              }

              // ensure combined modal is closed
              setAddVehicleCustomerModalOpen(false)
              setAddVehicleModalOpen(true)
            }}
          >
            Yes
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={customerNotFoundAlert} onOpenChange={setCustomerNotFoundAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Customer Not Found</AlertDialogTitle>
            <AlertDialogDescription>
              Mobile number not registered. Add customer first?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreateCustomer}>
            Yes
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={noVehiclesAlert} onOpenChange={setNoVehiclesAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Vehicles Found</AlertDialogTitle>
            <AlertDialogDescription>
              No vehicles under this customer. Do you want to add a vehicle?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setNoVehiclesAlert(false)

              if (!formData.customerId) {
                setAddVehicleModalOpen(false)
                setCustomerNotFoundAlert(true)
                return
              }

              // ensure combined modal is closed
              setAddVehicleCustomerModalOpen(false)
              setAddVehicleModalOpen(true)
            }}
          >
            Yes
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={activeJobcardAlert} onOpenChange={setActiveJobcardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notice</AlertDialogTitle>
            <AlertDialogDescription>
              {activeJobcardAlertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => setActiveJobcardAlert(false)}>
            OK
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

"use client"

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamicImport from "next/dynamic"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { Sidebar, menuItems } from "@/components/dashboard/sidebar"
import { TopBar, type TopBarSearchConfig } from "@/components/dashboard/top-bar"
import { PlaceholderContent } from "@/components/dashboard/placeholder-content"
import { JobCardTabStrip, type JobCardSubformTab } from "@/components/dashboard/job-card-tab-strip"
import { useEmployeeSearch } from "@/hooks/useEmployeeSearch"
import { useTechnicianSearch } from "@/hooks/useTechnicianSearch"
import { useMaintenanceSearch } from "@/hooks/useMaintenanceSearch"
import { useAttendanceSearch } from "@/hooks/useAttendanceSearch"
import { useCustomerSearch } from "@/hooks/useCustomerSearch"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"
import { useInventorySupplierSearch } from "@/hooks/useInventorySupplierSearch"
import { useSparePartsSearch } from "@/hooks/useSparePartsSearch"
import { useIncomeExpenseSearch } from "@/hooks/useIncomeExpenseSearch"
import { canAccessMenu, OFFICE_ATTENDANCE_ROLES, type UserRole } from "@/lib/access-control"
import { getOrCreateDeviceId } from "@/lib/device-identity"
import { getTodayISODateInIndia } from "@/lib/utils"
import { SupplierAutocomplete } from "@/components/SupplierAutocomplete"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ClipboardList,
  Home,
  FilePlus,
  FileMinus,
  FileText,
  Wrench,
  ClipboardCheck,
  Truck,
  User,
  Users,
  CalendarCheck,
  Package,
  ShoppingCart,
  UserCircle,
  TrendingUpDown,
  Cog,
  Settings,
  RotateCcw,
  Save,
  X,
  Search,
  Percent,
  Store,
  MapPin,
  MessageCircle,
  SlidersHorizontal,
  Banknote,
  CreditCard,
  Calendar,
  Droplets,
  Filter,
  DollarSign,
  Bell,
} from "lucide-react"

export const dynamic = 'force-dynamic'

const NewJobCardForm = dynamicImport(
  () => import("@/components/dashboard/new-job-card-form").then((m) => m.NewJobCardForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const UpdateJobCardForm = dynamicImport(
  () => import("@/components/dashboard/update-job-card-form").then((m) => m.UpdateJobCardForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const ReadyForDeliveryForm = dynamicImport(
  () => import("@/components/dashboard/ready-for-delivery-form").then((m) => m.ReadyForDeliveryForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const EmployeeMasterForm = dynamicImport(
  () => import("@/components/dashboard/employee-master-form").then((m) => m.EmployeeMasterForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const AttendancePayrollModule = dynamicImport(
  () => import("@/components/dashboard/attendance-payroll-module").then((m) => m.AttendancePayrollModule),
  { loading: () => <div className="text-sm text-muted-foreground">Loading module...</div> }
)

const SupplierProductInventoryForm = dynamicImport(
  () =>
    import("@/components/dashboard/supplier-product-inventory-form").then(
      (m) => m.SupplierProductInventoryForm
    ),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const SparePartsPurchaseLedger = dynamicImport(
  () => import("@/components/dashboard/spare-parts-purchase-ledger").then((m) => m.SparePartsPurchaseLedger),
  { loading: () => <div className="text-sm text-muted-foreground">Loading ledger...</div> }
)

const CustomerVehicleManagement = dynamicImport(
  () => import("@/components/dashboard/customer-vehicle-management").then((m) => m.CustomerVehicleManagement),
  { loading: () => <div className="text-sm text-muted-foreground">Loading module...</div> }
)

const InventoryPosModule = dynamicImport(
  () => import("@/components/dashboard/inventory-pos-module").then((m) => m.InventoryPosModule),
  { loading: () => <div className="text-sm text-muted-foreground">Loading POS...</div> }
)

const AccountingMasterForm = dynamicImport(
  () => import("@/components/dashboard/accounting-master-form").then((m) => m.AccountingMasterForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading module...</div> }
)

const SettingsModule = dynamicImport(
  () => import("@/components/settings/settings-module"),
  { loading: () => <div className="text-sm text-muted-foreground">Loading settings...</div> }
)

const SparePartShopsForm = dynamicImport(
  () => import("@/components/settings/spare-part-shops-form"),
  { loading: () => <div className="text-sm text-muted-foreground">Loading shops...</div> }
)

const MaintenanceTracker = dynamicImport(
  () => import("@/components/maintenance/maintenance-tracker"),
  { loading: () => <div className="text-sm text-muted-foreground">Loading tracker...</div> }
)

const TechnicianTaskDetailsForm = dynamicImport(
  () => import("@/components/dashboard/technician-task-details-form").then((m) => m.TechnicianTaskDetailsForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading task details...</div> }
)

const WhatsAppAdminMessagesComponent = dynamicImport(
  () => import("@/components/dashboard/whatsapp-admin-messages").then((m) => m.WhatsAppAdminMessages),
  { loading: () => <div className="text-sm text-muted-foreground">Loading messages...</div> }
)

const AllNotificationsModule = dynamicImport(
  () => import("@/components/dashboard/all-notifications-module").then((m) => m.AllNotificationsModule),
  { loading: () => <div className="text-sm text-muted-foreground">Loading notifications...</div> }
)

function WhatsAppNavIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.49 2 2 6.37 2 11.75c0 1.95.6 3.84 1.74 5.45L2.5 22l4.98-1.2A10.1 10.1 0 0 0 12 21.5c5.51 0 10-4.37 10-9.75S17.51 2 12 2Zm0 17.71c-1.5 0-2.97-.39-4.27-1.12l-.31-.18-2.95.71.79-2.82-.2-.31a7.64 7.64 0 0 1-1.23-4.24c0-4.27 3.67-7.74 8.17-7.74s8.17 3.47 8.17 7.74-3.66 7.96-8.17 7.96Zm4.57-5.98c-.25-.12-1.47-.71-1.69-.79-.23-.09-.39-.12-.56.12-.17.24-.65.79-.79.95-.15.15-.29.17-.54.06-.25-.12-1.07-.38-2.03-1.2a7.5 7.5 0 0 1-1.4-1.69c-.15-.24-.02-.37.1-.48.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.18.04-.33-.02-.46-.06-.12-.56-1.34-.77-1.84-.2-.47-.41-.41-.56-.42h-.48c-.17 0-.46.06-.7.33-.24.27-.91.89-.91 2.17s.93 2.51 1.05 2.69c.12.17 1.82 2.79 4.4 3.9.62.27 1.11.43 1.49.55.62.2 1.19.17 1.64.1.5-.08 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  )
}

const iconMap: Record<string, React.ElementType> = {
  dashboard: Home,
  "job-cards": ClipboardList,
  "new-job-card": FilePlus,
  "update-job-card": Wrench,
  "technician-task-details": ClipboardCheck,
  delivered: Truck,
  "maintenance-tracker": Package,
  employee: User,
  "attendance-payroll": CalendarCheck,
  inventory: Users,
  "inventory-pos": ShoppingCart,
  customers: UserCircle,
  "income-expense": TrendingUpDown,
  "spare-parts": Cog,
  "whatsapp-messages": WhatsAppNavIcon,
  settings: Settings,
  "all-notifications": Bell,
}

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  "new-job-card": "New Job Card",
  "update-job-card": "Under Service",
  "technician-task-details": "Technician Tasks",
  delivered: "Ready for Delivery",
  "maintenance-tracker": "Maintenance Tracker",
  employee: "Employee",
  "attendance-payroll": "Attendance & Payroll",
  inventory: "Suppliers & Products",
  "inventory-pos": "Inventory POS",
  customers: "Customers",
  "income-expense": "Income - Expense",
  "spare-parts": "Spare Parts",
  "whatsapp-messages": "WhatsApp Messages",
  settings: "Settings",
  "all-notifications": "Notifications",
}

interface JobCardNavigationItem {
  id: string
  jobCardNumber: string
}

function PosNotesSearch({
  search,
  onSearchChange,
  parties,
  recordCount,
  placeholder,
}: {
  search: string
  onSearchChange: (v: string) => void
  parties: string[]
  recordCount: number
  placeholder: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const filtered = parties.filter((p) => p.toLowerCase().includes(search.trim().toLowerCase()))
  const nav = useDropdownKeyboardNav({
    itemCount: filtered.length,
    isOpen,
    onSelect: (i) => { onSearchChange(filtered[i]); setIsOpen(false) },
    onClose: () => setIsOpen(false),
  })
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  return (
    <div className="flex items-center gap-2">
      {recordCount > 0 ? (
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {recordCount} of {recordCount}
        </span>
      ) : null}
      <div ref={containerRef} className="relative w-[17.5rem]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => { onSearchChange(e.target.value); setIsOpen(true); nav.resetHighlight() }}
          onClick={() => setIsOpen(true)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) { e.preventDefault(); setIsOpen(true); return }
            if (isOpen) nav.handleKeyDown(e)
          }}
          placeholder={placeholder}
          className="global-topbar-search pl-8"
          autoComplete="off"
        />
        {isOpen && (
          <div className="dropdown-container">
            <div className="dropdown-scroll" role="listbox">
              {filtered.length > 0 ? (
                filtered.map((party, index) => (
                  <button
                    key={party}
                    type="button"
                    role="option"
                    {...nav.getItemProps(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onSearchChange(party); setIsOpen(false) }}
                    className={`dropdown-item ${index === nav.highlightedIndex ? "selected" : ""}`}
                  >
                    <div className="font-medium">{party}</div>
                  </button>
                ))
              ) : (
                <div className="dropdown-empty-state">No parties found.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  employeeRefId?: number | null
  approvedDeviceId?: string | null
  approvedDeviceIp?: string | null
  pendingDeviceId?: string | null
  pendingDeviceIp?: string | null
  deviceApprovalStatus?: string | null
}

function PageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeItem, setActiveItem] = useState("dashboard")
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [deviceStatusBadge, setDeviceStatusBadge] = useState<{ label: string; tone: "ok" | "warn" } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [navigationRecords, setNavigationRecords] = useState<JobCardNavigationItem[]>([])
  const [deliveredRegistrationFilter, setDeliveredRegistrationFilter] = useState("")
  const [searchValue, setSearchValue] = useState("")
  const [searchInputFocused, setSearchInputFocused] = useState(false)
  const {
    customerSearch,
    setCustomerSearch,
    filteredResults: customerFilteredResults,
    isCustomerSearchOpen,
    setIsCustomerSearchOpen,
    isLoading: isCustomerSearchLoading,
    customerSearchInputRef,
    customerSearchContainerRef,
    openCustomerDropdown,
    customerDropdownNav,
  } = useCustomerSearch(activeItem)
  const [customerRecordCount, setCustomerRecordCount] = useState(0)
  const {
    technicianSearch,
    setTechnicianSearch,
    filteredTechnicianNames,
    isTechnicianSearchOpen,
    setIsTechnicianSearchOpen,
    technicianSearchInputRef,
    technicianSearchContainerRef,
    openTechnicianSearchDropdown,
    technicianDropdownNav,
  } = useTechnicianSearch(activeItem)
  const {
    maintenanceSearch,
    setMaintenanceSearch,
    filteredOptions: maintenanceFilteredOptions,
    isMaintenanceSearchOpen,
    setIsMaintenanceSearchOpen,
    maintenanceSearchInputRef,
    maintenanceSearchContainerRef,
    openMaintenanceDropdown,
    maintenanceDropdownNav,
  } = useMaintenanceSearch(activeItem)
  const {
    attendancePayrollSearch,
    setAttendancePayrollSearch,
    filteredEmployees: attendanceFilteredEmployees,
    isAttendanceSearchOpen,
    setIsAttendanceSearchOpen,
    attendanceSearchInputRef,
    attendanceSearchContainerRef,
    openAttendanceDropdown,
    attendanceDropdownNav,
  } = useAttendanceSearch(activeItem)
  const [attendancePayrollRecordCount, setAttendancePayrollRecordCount] = useState(0)
  const [inventoryRecordCount, setInventoryRecordCount] = useState(0)
  const [maintenanceTrackerTab, setMaintenanceTrackerTab] = useState<string>("all")
  const {
    employeeSearch,
    setEmployeeSearch,
    employeeSearchResults,
    isEmployeeSearchOpen,
    setIsEmployeeSearchOpen,
    isEmployeeSearchLoading,
    selectedEmployeeRecordId,
    setSelectedEmployeeRecordId,
    employeeSearchInputRef,
    employeeSearchContainerRef,
    loadEmployeeSearchResults,
    handleSelectEmployeeSearchResult,
    openEmployeeSearchDropdown,
    employeeDropdownNav,
  } = useEmployeeSearch(activeItem)
  const [sparePartsTab, setSparePartsTab] = useState<"all" | "returned" | "payments" | "shops">("all")
  const [attendancePayrollTab, setAttendancePayrollTab] = useState<"attendance" | "adjustments" | "payroll">("attendance")
  const [attendanceDate, setAttendanceDate] = useState<string>(() => getTodayISODateInIndia())
  const [employeeRecordCount, setEmployeeRecordCount] = useState(0)
  const [inventoryTab, setInventoryTab] = useState<"suppliers" | "products">("suppliers")
  const {
    inventorySearch,
    setInventorySearch,
    filteredSuppliers: inventoryFilteredSuppliers,
    isSupplierSearchOpen,
    setIsSupplierSearchOpen,
    supplierSearchInputRef,
    supplierSearchContainerRef,
    openSupplierDropdown,
    supplierDropdownNav,
  } = useInventorySupplierSearch(activeItem, inventoryTab)
  const [inventorySelectedSupplierSummary, setInventorySelectedSupplierSummary] = useState<{ name: string; mobile: string } | null>(null)
  const inventorySupplierSelectRef = useRef<((supplier: { supplierId: number }) => void) | null>(null)
  const [inventoryPosTab, setInventoryPosTab] = useState<"purchase" | "sales" | "inventory" | "stock-movement" | "credit-notes" | "debit-notes" | "gst-report">("purchase")
  const [inventoryPosSearch, setInventoryPosSearch] = useState("")
  const [inventoryPosParties, setInventoryPosParties] = useState<string[]>([])
  const [inventoryPosSupplierFilter, setInventoryPosSupplierFilter] = useState("")
  const [inventoryPosSupplierOptions, setInventoryPosSupplierOptions] = useState<string[]>([])
  const [inventoryPosSupplierSearch, setInventoryPosSupplierSearch] = useState("")
  const [isInventoryPosSupplierOpen, setIsInventoryPosSupplierOpen] = useState(false)
  const [inventoryPosRecordCount, setInventoryPosRecordCount] = useState(0)
  const {
    incomeExpenseSearch,
    setIncomeExpenseSearch,
    filteredTypes: incomeExpenseFilteredTypes,
    isIncomeExpenseSearchOpen,
    setIsIncomeExpenseSearchOpen,
    incomeExpenseSearchInputRef,
    incomeExpenseSearchContainerRef,
    openIncomeExpenseDropdown,
    incomeExpenseDropdownNav,
  } = useIncomeExpenseSearch(activeItem)
  const [incomeExpenseRecordCount, setIncomeExpenseRecordCount] = useState(0)
  const {
    sparePartsSearch,
    setSparePartsSearch,
    filteredShopNames: sparePartsFilteredShops,
    isSparePartsSearchOpen,
    setIsSparePartsSearchOpen,
    sparePartsSearchInputRef,
    sparePartsSearchContainerRef,
    openSparePartsDropdown,
    sparePartsDropdownNav,
  } = useSparePartsSearch(activeItem)
  const [sparePartsRecordCount, setSparePartsRecordCount] = useState(0)
  const [settingsSearch, setSettingsSearch] = useState("")
  const [updateJobCardSubformTab, setUpdateJobCardSubformTab] = useState<JobCardSubformTab>("main-form")
  const [readyForDeliverySubformTab, setReadyForDeliverySubformTab] = useState<JobCardSubformTab>("main-form")
  const [settingsTab, setSettingsTab] = useState<"shop" | "gst-states">("shop")
  const [sparePartsShopFilter, setSparePartsShopFilter] = useState("")
  const [sparePartsStartDate, setSparePartsStartDate] = useState("")
  const [sparePartsEndDate, setSparePartsEndDate] = useState("")
  const [whatsAppContactName, setWhatsAppContactName] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const inventoryPosSupplierSearchRef = useRef<HTMLDivElement>(null)

  const selectedJobCardId = searchParams.get("jobCardId") || ""

  const handleSelect = useCallback((id: string) => {
    if (!currentUser || !canAccessMenu(currentUser.role, id)) {
      return
    }
    setActiveItem(id)
    setSidebarOpen(false)
  }, [currentUser])

  const ActiveIcon = iconMap[activeItem] || Home
  const activeLabel = labelMap[activeItem] || "Dashboard"

  const currentRecordIndex = useMemo(() => {
    if (!selectedJobCardId) {
      return -1
    }
    return navigationRecords.findIndex((item) => item.id === selectedJobCardId)
  }, [selectedJobCardId, navigationRecords])

  const totalRecords = navigationRecords.length

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        if (!response.ok) {
          router.replace("/register")
          return
        }

        const data = await response.json()
        if (mounted && data?.user) {
          if (data.user.role !== "admin") {
            const currentDeviceId = getOrCreateDeviceId()
            const approvedDeviceId = String(data.user.approvedDeviceId || "").trim()
            const pendingDeviceId = String(data.user.pendingDeviceId || "").trim()

            if (pendingDeviceId && pendingDeviceId === currentDeviceId) {
              setDeviceStatusBadge({
                label: "Device change requested. Waiting for admin approval.",
                tone: "warn",
              })
            } else if (approvedDeviceId && approvedDeviceId === currentDeviceId) {
              setDeviceStatusBadge(null)
            } else if (approvedDeviceId) {
              setDeviceStatusBadge({
                label: "This browser device is not approved for this account.",
                tone: "warn",
              })
            } else {
              setDeviceStatusBadge({
                label: "No approved device is currently mapped.",
                tone: "warn",
              })
            }
          } else {
            setDeviceStatusBadge(null)
          }

          if (typeof window !== "undefined") {
            localStorage.setItem("gms_user_role", String(data.user.role || ""))
            if (data.user.employeeRefId) {
              localStorage.setItem("gms_employee_id", String(data.user.employeeRefId))
            } else {
              localStorage.removeItem("gms_employee_id")
            }
          }

          // Redirect office-only roles directly to the mobile attendance page
          const userRole = String(data.user.role || "") as UserRole
          if (OFFICE_ATTENDANCE_ROLES.includes(userRole)) {
            router.replace("/mobile-attendance")
            return
          }

          setCurrentUser(data.user)
        }
      } catch (error) {
        console.error("[PAGE_SESSION_LOAD]", error)
        // Only redirect on actual auth errors, not transient network/DB failures
        const isAuthError = error instanceof Response
          ? (error.status === 401 || error.status === 403)
          : false
        if (isAuthError) {
          router.replace("/register")
        }
      } finally {
        if (mounted) {
          setAuthLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      mounted = false
    }
  }, [router])

  useEffect(() => {
    const form = searchParams.get("form")
    if (!form || !currentUser) {
      return
    }

    if (canAccessMenu(currentUser.role, form)) {
      setActiveItem(form)
    }
  }, [searchParams, currentUser])

  useEffect(() => {
    if (!currentUser) {
      return
    }

    if (!canAccessMenu(currentUser.role, activeItem)) {
      setActiveItem("dashboard")
    }
  }, [activeItem, currentUser])

  // Clear context-aware search state when switching away from its form
  useEffect(() => {
    if (activeItem !== "technician-task-details") setTechnicianSearch("")
    if (activeItem !== "maintenance-tracker") setMaintenanceSearch("")
    if (activeItem !== "maintenance-tracker") setMaintenanceTrackerTab("all")
    if (activeItem !== "attendance-payroll") setAttendancePayrollSearch("")
    if (activeItem !== "inventory") setInventorySearch("")
    if (activeItem !== "inventory-pos") setInventoryPosSearch("")
  }, [activeItem])

  useEffect(() => {
    if (!(activeItem === "inventory-pos" && inventoryPosTab === "inventory")) return

    let cancelled = false
    const loadSuppliers = async () => {
      try {
        const res = await fetch("/api/suppliers", { cache: "no-store" })
        if (!res.ok) return
        const rows = await res.json()
        if (!Array.isArray(rows) || cancelled) return

        const options = Array.from(
          new Set(
            rows
              .map((row: any) => String(row?.supplierName || "").trim())
              .filter((name: string) => name.length > 0)
          )
        ).sort((a, b) => a.localeCompare(b))

        if (!cancelled) setInventoryPosSupplierOptions(options)
      } catch {
      }
    }

    void loadSuppliers()
    return () => {
      cancelled = true
    }
  }, [activeItem, inventoryPosTab])

  useEffect(() => {
    if (!(activeItem === "inventory-pos" && inventoryPosTab === "inventory")) {
      setIsInventoryPosSupplierOpen(false)
      setInventoryPosSupplierSearch("")
      return
    }

    if (!inventoryPosSupplierFilter || inventoryPosSupplierFilter === "all") {
      setInventoryPosSupplierSearch("")
    } else {
      setInventoryPosSupplierSearch(inventoryPosSupplierFilter)
    }
  }, [activeItem, inventoryPosSupplierFilter, inventoryPosTab])

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (!inventoryPosSupplierSearchRef.current?.contains(event.target as Node)) {
        setIsInventoryPosSupplierOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [])

  useEffect(() => {
    if (!(activeItem === "inventory-pos" && inventoryPosTab === "inventory")) return
    window.dispatchEvent(
      new CustomEvent("inventoryPosInventory:setSupplier", {
        detail: { supplier: inventoryPosSupplierFilter },
      })
    )
  }, [activeItem, inventoryPosSupplierFilter, inventoryPosTab])

  const fetchNavigationRecords = useCallback(
    async (options?: { jobcardStatus?: string; registrationNumber?: string; excludeVehicleStatus?: string }) => {
    try {
      const params = new URLSearchParams()

      if (options?.jobcardStatus) {
        params.set("jobcardStatus", options.jobcardStatus)
      }

      if (options?.registrationNumber) {
        params.set("registrationNumber", options.registrationNumber)
      }

      if (options?.excludeVehicleStatus) {
        params.set("excludeVehicleStatus", options.excludeVehicleStatus)
      }

      const url = params.toString()
        ? `/api/jobcards/navigation?${params.toString()}`
        : "/api/jobcards/navigation"

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch navigation records")
      }

      setNavigationRecords(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching navigation records:", error)
      setNavigationRecords([])
    }
    },
    []
  )

  useEffect(() => {
    if (activeItem === "update-job-card") {
      fetchNavigationRecords()
      return
    }

    if (activeItem === "delivered") {
      fetchNavigationRecords({
        jobcardStatus: "Completed",
        registrationNumber: deliveredRegistrationFilter,
        excludeVehicleStatus: "Delivered",
      })
      return
    }

    setNavigationRecords([])
  }, [activeItem, deliveredRegistrationFilter, fetchNavigationRecords])

  const setSelectedJobCardId = (jobCardId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("jobCardId", jobCardId)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const clearSelectedJobCardId = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("jobCardId")
    router.replace(params.toString() ? `?${params.toString()}` : "?", { scroll: false })
  }

  const handleNavigatePrevious = useCallback(() => {
    const currentIndex = navigationRecords.findIndex((r) => r.id === selectedJobCardId)
    if (currentIndex > 0) {
      const previousRecord = navigationRecords[currentIndex - 1]
      setActiveItem("update-job-card")
      setSelectedJobCardId(previousRecord.id)
    }
  }, [navigationRecords, selectedJobCardId])

  const handleNavigateNext = useCallback(() => {
    const currentIndex = navigationRecords.findIndex((r) => r.id === selectedJobCardId)
    if (currentIndex < navigationRecords.length - 1) {
      const nextRecord = navigationRecords[currentIndex + 1]
      setActiveItem("update-job-card")
      setSelectedJobCardId(nextRecord.id)
    }
  }, [navigationRecords, selectedJobCardId])

  const handleNotificationNavigate = useCallback((targetForm: string) => {
    if (currentUser && canAccessMenu(currentUser.role, targetForm)) {
      setActiveItem(targetForm)
      return
    }
    if (targetForm.startsWith("/")) {
      router.push(targetForm)
      return
    }
    router.push(`/?form=${encodeURIComponent(targetForm)}`)
  }, [currentUser, router])

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("gms_user_role")
        localStorage.removeItem("gms_employee_id")
      }
      router.replace("/register")
    }
  }, [router])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 p-[1mm] gap-[1mm]">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:transform-none`}
      >
        <div className="relative h-full rounded-2xl overflow-hidden">
          <Sidebar
            activeItem={activeItem}
            onSelect={handleSelect}
            role={currentUser.role}
            userName={currentUser.name}
            onNotificationNavigate={handleNotificationNavigate}
            onLogout={handleLogout}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">

        <TopBar
          pageTitle={activeLabel}
          pageIcon={ActiveIcon}
          pageSubtitle={activeItem === "whatsapp-messages" && whatsAppContactName ? whatsAppContactName : undefined}
          searchConfig={
            activeItem === "update-job-card" || activeItem === "delivered"
              ? {
                  placeholder: "Search Vehicle",
                  value: searchValue,
                  onChange: (v) => setSearchValue(v.toUpperCase()),
                  suffix: (
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {totalRecords === 0
                        ? "1 of 1"
                        : currentRecordIndex >= 0
                          ? `${currentRecordIndex + 1} of ${totalRecords + 1}`
                          : `${totalRecords + 1} of ${totalRecords + 1}`}
                    </span>
                  ),
                }
              : activeItem === "customers"
              ? undefined
              : activeItem === "income-expense"
              ? undefined
              : activeItem === "spare-parts"
              ? undefined
              : activeItem === "settings"
              ? undefined
              : activeItem === "maintenance-tracker"
              ? undefined
              : activeItem === "attendance-payroll"
              ? undefined
              : activeItem === "inventory"
              ? undefined
              : activeItem === "inventory-pos"
              ? inventoryPosTab === "inventory"
                  || inventoryPosTab === "credit-notes"
                  || inventoryPosTab === "debit-notes"
                ? undefined
                : {
                  placeholder:
                    inventoryPosTab === "purchase"
                      ? "Search purchase..."
                      : inventoryPosTab === "sales"
                        ? "Search sales..."
                        : inventoryPosTab === "stock-movement"
                            ? "Search movement..."
                            : "Search GST report...",
                  value: inventoryPosSearch,
                  onChange: setInventoryPosSearch,
                  suffix: inventoryPosRecordCount > 0 ? (
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {inventoryPosRecordCount} of {inventoryPosRecordCount}
                    </span>
                  ) : undefined,
                }
              : undefined
          }
          customSearch={
            activeItem === "attendance-payroll" ? (
              <div className="flex items-center gap-2">
                {attendancePayrollRecordCount > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {attendancePayrollRecordCount} of {attendancePayrollRecordCount}
                  </span>
                ) : null}
                <div ref={attendanceSearchContainerRef} className="relative w-[17.5rem]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    ref={attendanceSearchInputRef}
                    value={attendancePayrollSearch}
                    onChange={(e) => {
                      setAttendancePayrollSearch(e.target.value)
                      if (!isAttendanceSearchOpen) setIsAttendanceSearchOpen(true)
                      attendanceDropdownNav.resetHighlight()
                    }}
                    onClick={openAttendanceDropdown}
                    onFocus={openAttendanceDropdown}
                    onKeyDown={(e) => {
                      if (!isAttendanceSearchOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                        e.preventDefault()
                        openAttendanceDropdown()
                        return
                      }
                      if (isAttendanceSearchOpen) attendanceDropdownNav.handleKeyDown(e)
                    }}
                    placeholder="Search employee..."
                    className="global-topbar-search pl-8"
                    autoComplete="off"
                    aria-label="Search Employee"
                    aria-autocomplete="list"
                    aria-expanded={isAttendanceSearchOpen}
                    aria-controls="attendance-search-dropdown"
                  />
                  {isAttendanceSearchOpen && (
                    <div className="dropdown-container">
                      <div id="attendance-search-dropdown" className="dropdown-scroll" role="listbox">
                        {attendanceFilteredEmployees.length > 0 ? (
                          attendanceFilteredEmployees.map((emp, index) => (
                            <button
                              key={emp.employeeId}
                              type="button"
                              role="option"
                              aria-selected={index === attendanceDropdownNav.highlightedIndex}
                              {...attendanceDropdownNav.getItemProps(index)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setAttendancePayrollSearch(emp.empName)
                                setIsAttendanceSearchOpen(false)
                              }}
                              className={`dropdown-item ${index === attendanceDropdownNav.highlightedIndex ? "selected" : ""}`}
                            >
                              <div className="font-medium">{emp.empName}</div>
                              <div className="text-xs text-muted-foreground">
                                {emp.idNumber}
                                {emp.designation ? ` · ${emp.designation}` : ""}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="dropdown-empty-state">No employees found.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeItem === "maintenance-tracker" ? (
              <div ref={maintenanceSearchContainerRef} className="relative w-[17.5rem]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <Input
                  ref={maintenanceSearchInputRef}
                  value={maintenanceSearch}
                  onChange={(e) => {
                    setMaintenanceSearch(e.target.value)
                    if (!isMaintenanceSearchOpen) setIsMaintenanceSearchOpen(true)
                    maintenanceDropdownNav.resetHighlight()
                  }}
                  onClick={openMaintenanceDropdown}
                  onFocus={openMaintenanceDropdown}
                  onKeyDown={(e) => {
                    if (!isMaintenanceSearchOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                      e.preventDefault()
                      openMaintenanceDropdown()
                      return
                    }
                    if (isMaintenanceSearchOpen) maintenanceDropdownNav.handleKeyDown(e)
                  }}
                  placeholder="Search customer, mobile or vehicle..."
                  className="global-topbar-search pl-8"
                  autoComplete="off"
                  aria-label="Search Maintenance"
                  aria-autocomplete="list"
                  aria-expanded={isMaintenanceSearchOpen}
                  aria-controls="maintenance-search-dropdown"
                />
                {isMaintenanceSearchOpen && (
                  <div className="dropdown-container">
                    <div id="maintenance-search-dropdown" className="dropdown-scroll" role="listbox">
                      {maintenanceFilteredOptions.length > 0 ? (
                        maintenanceFilteredOptions.map((opt, index) => (
                          <button
                            key={`${opt.vehicleId}-${opt.customerId}`}
                            type="button"
                            role="option"
                            aria-selected={index === maintenanceDropdownNav.highlightedIndex}
                            {...maintenanceDropdownNav.getItemProps(index)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setMaintenanceSearch(opt.registrationNumber)
                              setIsMaintenanceSearchOpen(false)
                            }}
                            className={`dropdown-item ${index === maintenanceDropdownNav.highlightedIndex ? "selected" : ""}`}
                          >
                            <div className="font-medium">{opt.registrationNumber}</div>
                            <div className="text-xs text-muted-foreground">{opt.make} {opt.model}</div>
                            <div className="text-xs text-slate-700 mt-0.5">{opt.customerName} · {opt.mobileNo}</div>
                          </button>
                        ))
                      ) : (
                        <div className="dropdown-empty-state">No matching records</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : activeItem === "employee" ? (
              <div className="flex items-center gap-2">
                {employeeRecordCount > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {employeeRecordCount} of {employeeRecordCount}
                  </span>
                ) : null}
                <div ref={employeeSearchContainerRef} className="relative w-[17.5rem]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    ref={employeeSearchInputRef}
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value)
                      if (!isEmployeeSearchOpen) setIsEmployeeSearchOpen(true)
                      employeeDropdownNav.resetHighlight()
                    }}
                    onClick={openEmployeeSearchDropdown}
                    onFocus={openEmployeeSearchDropdown}
                    onKeyDown={(e) => {
                      if (!isEmployeeSearchOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                        e.preventDefault()
                        openEmployeeSearchDropdown()
                        return
                      }
                      if (isEmployeeSearchOpen) employeeDropdownNav.handleKeyDown(e)
                    }}
                    placeholder="Search employee..."
                    className="global-topbar-search pl-8"
                    aria-label="Search Employee"
                    aria-autocomplete="list"
                    aria-expanded={isEmployeeSearchOpen}
                    aria-controls="employee-search-dropdown"
                  />
                  {isEmployeeSearchOpen && (
                    <div className="dropdown-container">
                      <div id="employee-search-dropdown" className="dropdown-scroll" role="listbox">
                        {isEmployeeSearchLoading ? (
                          <div className="dropdown-empty-state">Loading employees...</div>
                        ) : employeeSearchResults.length > 0 ? (
                          employeeSearchResults.map((employee, index) => (
                            <button
                              key={employee.employeeId}
                              type="button"
                              role="option"
                              aria-selected={index === employeeDropdownNav.highlightedIndex}
                              {...employeeDropdownNav.getItemProps(index)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectEmployeeSearchResult(employee)}
                              className={`dropdown-item ${index === employeeDropdownNav.highlightedIndex ? "selected" : ""}`}
                            >
                              <div className="font-medium">{employee.empName}</div>
                              <div className="text-xs text-muted-foreground">
                                {employee.mobile}
                                {employee.designation ? ` • ${employee.designation}` : ""}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="dropdown-empty-state">No employees found.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeItem === "inventory" && inventoryTab === "products" ? (
              <div className="w-[17.5rem]">
                <SupplierAutocomplete
                  placeholder="Search supplier..."
                  onSelect={(s) => inventorySupplierSelectRef.current?.(s)}
                  inputClassName="global-topbar-search"
                />
              </div>
            ) : activeItem === "inventory-pos" && inventoryPosTab === "inventory" ? (
              <div className="w-[17.5rem]" ref={inventoryPosSupplierSearchRef}>
                <div className="relative w-[17.5rem]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    value={inventoryPosSupplierSearch}
                    onChange={(e) => {
                      setInventoryPosSupplierSearch(e.target.value)
                      setIsInventoryPosSupplierOpen(true)
                      if (!e.target.value.trim()) {
                        setInventoryPosSupplierFilter("")
                      }
                    }}
                    onFocus={() => setIsInventoryPosSupplierOpen(true)}
                    onClick={() => setIsInventoryPosSupplierOpen(true)}
                    placeholder="Select supplier to search"
                    className="global-topbar-search pl-8"
                    aria-label="Select supplier to search"
                    autoComplete="off"
                  />
                  {isInventoryPosSupplierOpen && (
                    <div className="dropdown-container">
                      <div className="dropdown-scroll" role="listbox" aria-label="Supplier options">
                        <button
                          type="button"
                          role="option"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setInventoryPosSupplierFilter("all")
                            setInventoryPosSupplierSearch("")
                            setIsInventoryPosSupplierOpen(false)
                          }}
                          className="dropdown-item"
                        >
                          All Suppliers
                        </button>
                        {inventoryPosSupplierOptions
                          .filter((supplierName) =>
                            supplierName.toLowerCase().includes(inventoryPosSupplierSearch.trim().toLowerCase())
                          )
                          .map((supplierName) => (
                            <button
                              key={supplierName}
                              type="button"
                              role="option"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setInventoryPosSupplierFilter(supplierName)
                                setInventoryPosSupplierSearch(supplierName)
                                setIsInventoryPosSupplierOpen(false)
                              }}
                              className={`dropdown-item ${inventoryPosSupplierFilter === supplierName ? "selected" : ""}`}
                            >
                              {supplierName}
                            </button>
                          ))}
                        {inventoryPosSupplierOptions.filter((supplierName) =>
                          supplierName.toLowerCase().includes(inventoryPosSupplierSearch.trim().toLowerCase())
                        ).length === 0 ? (
                          <div className="dropdown-empty-state">No suppliers found.</div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeItem === "customers" ? (
              <div className="flex items-center gap-2">
                {customerRecordCount > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {customerRecordCount} of {customerRecordCount}
                  </span>
                ) : null}
                <div ref={customerSearchContainerRef} className="relative w-[17.5rem]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    ref={customerSearchInputRef}
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      if (!isCustomerSearchOpen) setIsCustomerSearchOpen(true)
                      customerDropdownNav.resetHighlight()
                    }}
                    onClick={openCustomerDropdown}
                    onFocus={openCustomerDropdown}
                    onKeyDown={(e) => {
                      if (!isCustomerSearchOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                        e.preventDefault()
                        openCustomerDropdown()
                        return
                      }
                      if (isCustomerSearchOpen) customerDropdownNav.handleKeyDown(e)
                    }}
                    placeholder="Search customer by name, mobile, vehicle..."
                    className="global-topbar-search pl-8"
                    autoComplete="off"
                    aria-label="Search Customer"
                    aria-autocomplete="list"
                    aria-expanded={isCustomerSearchOpen}
                    aria-controls="customer-search-dropdown"
                  />
                  {isCustomerSearchOpen && (
                    <div className="dropdown-container">
                      <div id="customer-search-dropdown" className="dropdown-scroll" role="listbox">
                        {isCustomerSearchLoading ? (
                          <div className="dropdown-empty-state">Loading...</div>
                        ) : customerFilteredResults.length > 0 ? (
                          customerFilteredResults.map((c, index) => (
                            <button
                              key={c.id}
                              type="button"
                              role="option"
                              aria-selected={index === customerDropdownNav.highlightedIndex}
                              {...customerDropdownNav.getItemProps(index)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setCustomerSearch(c.name)
                                setIsCustomerSearchOpen(false)
                              }}
                              className={`dropdown-item ${index === customerDropdownNav.highlightedIndex ? "selected" : ""}`}
                            >
                              <div className="font-medium">{c.name}</div>
                              <div className="text-xs text-muted-foreground">{c.mobileNo}</div>
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
            ) : activeItem === "income-expense" ? (
              <div className="flex items-center gap-2">
                {incomeExpenseRecordCount > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {incomeExpenseRecordCount} of {incomeExpenseRecordCount}
                  </span>
                ) : null}
                <div ref={incomeExpenseSearchContainerRef} className="relative w-[17.5rem]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    ref={incomeExpenseSearchInputRef}
                    value={incomeExpenseSearch}
                    onChange={(e) => {
                      setIncomeExpenseSearch(e.target.value)
                      if (!isIncomeExpenseSearchOpen) setIsIncomeExpenseSearchOpen(true)
                      incomeExpenseDropdownNav.resetHighlight()
                    }}
                    onClick={openIncomeExpenseDropdown}
                    onFocus={openIncomeExpenseDropdown}
                    onKeyDown={(e) => {
                      if (!isIncomeExpenseSearchOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                        e.preventDefault()
                        openIncomeExpenseDropdown()
                        return
                      }
                      if (isIncomeExpenseSearchOpen) incomeExpenseDropdownNav.handleKeyDown(e)
                    }}
                    placeholder="Search income and expense records..."
                    className="global-topbar-search pl-8"
                    autoComplete="off"
                    aria-label="Search Income/Expense"
                    aria-autocomplete="list"
                    aria-expanded={isIncomeExpenseSearchOpen}
                    aria-controls="income-expense-search-dropdown"
                  />
                  {isIncomeExpenseSearchOpen && (
                    <div className="dropdown-container">
                      <div id="income-expense-search-dropdown" className="dropdown-scroll" role="listbox">
                        {incomeExpenseFilteredTypes.length > 0 ? (
                          incomeExpenseFilteredTypes.map((type, index) => (
                            <button
                              key={type}
                              type="button"
                              role="option"
                              aria-selected={index === incomeExpenseDropdownNav.highlightedIndex}
                              {...incomeExpenseDropdownNav.getItemProps(index)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setIncomeExpenseSearch(type)
                                setIsIncomeExpenseSearchOpen(false)
                              }}
                              className={`dropdown-item ${index === incomeExpenseDropdownNav.highlightedIndex ? "selected" : ""}`}
                            >
                              <div className="font-medium">{type}</div>
                            </button>
                          ))
                        ) : (
                          <div className="dropdown-empty-state">No matching types.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeItem === "spare-parts" && sparePartsTab !== "shops" ? (
              <div className="flex items-center gap-2">
                {sparePartsRecordCount > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {sparePartsRecordCount} of {sparePartsRecordCount}
                  </span>
                ) : null}
                <div ref={sparePartsSearchContainerRef} className="relative w-[17.5rem]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    ref={sparePartsSearchInputRef}
                    value={sparePartsSearch}
                    onChange={(e) => {
                      setSparePartsSearch(e.target.value)
                      if (!isSparePartsSearchOpen) setIsSparePartsSearchOpen(true)
                      sparePartsDropdownNav.resetHighlight()
                    }}
                    onClick={openSparePartsDropdown}
                    onFocus={openSparePartsDropdown}
                    onKeyDown={(e) => {
                      if (!isSparePartsSearchOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                        e.preventDefault()
                        openSparePartsDropdown()
                        return
                      }
                      if (isSparePartsSearchOpen) sparePartsDropdownNav.handleKeyDown(e)
                    }}
                    placeholder={
                      sparePartsTab === "all"
                        ? "Search spare parts ledger..."
                        : sparePartsTab === "returned"
                          ? "Search returned bills..."
                          : "Search bill payments..."
                    }
                    className="global-topbar-search pl-8"
                    autoComplete="off"
                    aria-label="Search Spare Parts"
                    aria-autocomplete="list"
                    aria-expanded={isSparePartsSearchOpen}
                    aria-controls="spare-parts-search-dropdown"
                  />
                  {isSparePartsSearchOpen && (
                    <div className="dropdown-container">
                      <div id="spare-parts-search-dropdown" className="dropdown-scroll" role="listbox">
                        {sparePartsFilteredShops.length > 0 ? (
                          sparePartsFilteredShops.map((shop, index) => (
                            <button
                              key={shop}
                              type="button"
                              role="option"
                              aria-selected={index === sparePartsDropdownNav.highlightedIndex}
                              {...sparePartsDropdownNav.getItemProps(index)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSparePartsSearch(shop)
                                setIsSparePartsSearchOpen(false)
                              }}
                              className={`dropdown-item ${index === sparePartsDropdownNav.highlightedIndex ? "selected" : ""}`}
                            >
                              <div className="font-medium">{shop}</div>
                            </button>
                          ))
                        ) : (
                          <div className="dropdown-empty-state">No shops found.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeItem === "inventory" && inventoryTab === "suppliers" ? (
              <div className="flex items-center gap-2">
                {inventoryRecordCount > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {inventoryRecordCount} of {inventoryRecordCount}
                  </span>
                ) : null}
                <div ref={supplierSearchContainerRef} className="relative w-[17.5rem]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    ref={supplierSearchInputRef}
                    value={inventorySearch}
                    onChange={(e) => {
                      setInventorySearch(e.target.value)
                      if (!isSupplierSearchOpen) setIsSupplierSearchOpen(true)
                      supplierDropdownNav.resetHighlight()
                    }}
                    onClick={openSupplierDropdown}
                    onFocus={openSupplierDropdown}
                    onKeyDown={(e) => {
                      if (!isSupplierSearchOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                        e.preventDefault()
                        openSupplierDropdown()
                        return
                      }
                      if (isSupplierSearchOpen) supplierDropdownNav.handleKeyDown(e)
                    }}
                    placeholder="Search supplier..."
                    className="global-topbar-search pl-8"
                    autoComplete="off"
                    aria-label="Search Supplier"
                    aria-autocomplete="list"
                    aria-expanded={isSupplierSearchOpen}
                    aria-controls="supplier-search-dropdown"
                  />
                  {isSupplierSearchOpen && (
                    <div className="dropdown-container">
                      <div id="supplier-search-dropdown" className="dropdown-scroll" role="listbox">
                        {inventoryFilteredSuppliers.length > 0 ? (
                          inventoryFilteredSuppliers.map((s, index) => (
                            <button
                              key={s.supplierId}
                              type="button"
                              role="option"
                              aria-selected={index === supplierDropdownNav.highlightedIndex}
                              {...supplierDropdownNav.getItemProps(index)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setInventorySearch(s.supplierName)
                                setIsSupplierSearchOpen(false)
                              }}
                              className={`dropdown-item ${index === supplierDropdownNav.highlightedIndex ? "selected" : ""}`}
                            >
                              <div className="font-medium">{s.supplierName}</div>
                              {s.mobile ? <div className="text-xs text-muted-foreground">{s.mobile}</div> : null}
                            </button>
                          ))
                        ) : (
                          <div className="dropdown-empty-state">No suppliers found.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeItem === "inventory-pos" && (inventoryPosTab === "credit-notes" || inventoryPosTab === "debit-notes") ? (
              <PosNotesSearch
                search={inventoryPosSearch}
                onSearchChange={setInventoryPosSearch}
                parties={inventoryPosParties}
                recordCount={inventoryPosRecordCount}
                placeholder={inventoryPosTab === "credit-notes" ? "Search credit note..." : "Search debit note..."}
              />
            ) : undefined
          }
          userName={currentUser.name}
          userRole={currentUser.role}
          whatsAppAllowed={canAccessMenu(currentUser.role, "whatsapp-messages")}
          onWhatsApp={() => handleSelect("whatsapp-messages")}
          onNotificationNavigate={handleNotificationNavigate}
          onToggleSidebar={() => setSidebarOpen(true)}
          searchInputRef={searchInputRef}
          onSearchFocusChange={setSearchInputFocused}
          showMobileActionIcons={activeItem === "dashboard"}
        />

        <main className="mt-[1mm] flex flex-1 min-h-0 flex-col gap-[1mm]">
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl bg-slate-100">
            <div
              className={`form-main-wrapper flex-1 min-h-0 overflow-hidden ${activeItem === "whatsapp-messages" ? "flex h-full min-h-0 flex-col !p-0" : `${(activeItem === "settings" || activeItem === "update-job-card" || activeItem === "delivered" || activeItem === "maintenance-tracker" || activeItem === "employee" || activeItem === "inventory" || activeItem === "inventory-pos" || activeItem === "all-notifications") ? "flex h-full min-h-0 flex-col" : ""} ${activeItem === "new-job-card" ? "h-full" : ""}`} ${(activeItem === "update-job-card" || activeItem === "delivered" || activeItem === "maintenance-tracker" || activeItem === "employee" || activeItem === "inventory" || activeItem === "inventory-pos" || activeItem === "all-notifications") ? "!px-0" : ""}`}
            >
            {deviceStatusBadge ? (
              <div
                className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                  deviceStatusBadge.tone === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {deviceStatusBadge.label}
              </div>
            ) : null}

            {sidebarOpen && (
              <div className="relative z-50 flex justify-end mb-3 lg:hidden">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded-lg bg-sidebar-accent text-sidebar-foreground"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {activeItem === "attendance-payroll" && (
              <div
                className={`global-tabs-wrap ${
                  attendancePayrollTab === "attendance" ? "is-first" : "is-offset"
                }`}
              >
                <Tabs
                  value={attendancePayrollTab}
                  onValueChange={(value) =>
                    setAttendancePayrollTab(value as "attendance" | "adjustments" | "payroll")
                  }
                >
                  <div className="flex w-full flex-wrap items-center gap-3">
                    <TabsList className="settings-tabs-list desktop-only-tab-strip">
                      <TabsTrigger value="attendance" className="settings-tabs-trigger">
                        <CalendarCheck className="h-4 w-4 text-slate-600" />
                        <span>{currentUser.role === "technician" ? "My Attendance" : "Mobile Attendance"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="adjustments" className="settings-tabs-trigger">
                        <SlidersHorizontal className="h-4 w-4 text-slate-600" />
                        <span>{currentUser.role === "technician" ? "Payment History" : "Adjustments"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="payroll" className="settings-tabs-trigger">
                        <Banknote className="h-4 w-4 text-slate-600" />
                        <span>{currentUser.role === "technician" ? "My Payroll" : "Payroll"}</span>
                      </TabsTrigger>
                    </TabsList>

                  </div>
                </Tabs>
              </div>
            )}

            {activeItem === "spare-parts" && (
              <div
                className={`global-tabs-wrap ${
                  sparePartsTab === "all" ? "is-first" : "is-offset"
                }`}
              >
                <Tabs
                  value={sparePartsTab}
                  onValueChange={(value) => setSparePartsTab(value as "all" | "returned" | "payments" | "shops")}
                >
                  <TabsList className="settings-tabs-list desktop-only-tab-strip">
                    <TabsTrigger value="all" className="settings-tabs-trigger">
                      <ClipboardList className="h-4 w-4 text-slate-600" />
                      <span>All Records</span>
                    </TabsTrigger>
                    <TabsTrigger value="returned" className="settings-tabs-trigger">
                      <RotateCcw className="h-4 w-4 text-slate-600" />
                      <span>Returned Bills</span>
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="settings-tabs-trigger">
                      <CreditCard className="h-4 w-4 text-slate-600" />
                      <span>Bill Payments</span>
                    </TabsTrigger>
                    <TabsTrigger value="shops" className="settings-tabs-trigger">
                      <Store className="h-4 w-4 text-slate-600" />
                      <span>Spare Part Shops</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {activeItem === "inventory" && (
              <div
                className={`global-tabs-wrap ${
                  inventoryTab === "suppliers" ? "is-first" : "is-offset"
                }`}
              >
                <div className="mb-2 mobile-only-tab-select">
                  <Select value={inventoryTab} onValueChange={(value) => setInventoryTab(value as "suppliers" | "products")}>
                    <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent className="rounded-md">
                      <SelectItem value="suppliers">Suppliers</SelectItem>
                      <SelectItem value="products">Products</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6">
                  <Tabs
                    value={inventoryTab}
                    onValueChange={(value) => setInventoryTab(value as "suppliers" | "products")}
                  >
                    <TabsList className="settings-tabs-list desktop-only-tab-strip">
                      <TabsTrigger value="suppliers" className="settings-tabs-trigger">
                        <Users className="h-4 w-4 text-slate-600" />
                        <span>Suppliers</span>
                      </TabsTrigger>
                      <TabsTrigger value="products" className="settings-tabs-trigger">
                        <Package className="h-4 w-4 text-slate-600" />
                        <span>Products</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {inventoryTab === "products" && inventorySelectedSupplierSummary ? (
                    <div className="flex min-w-0 items-center justify-self-end gap-2 pr-10 text-sm font-medium text-sky-600">
                      <span className="truncate">{inventorySelectedSupplierSummary.name}</span>
                      <span>-</span>
                      <span className="truncate">{inventorySelectedSupplierSummary.mobile}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {activeItem === "inventory-pos" && (
              <div
                className={`global-tabs-wrap ${
                  inventoryPosTab === "purchase" ? "is-first" : "is-offset"
                }`}
              >
                <div className="mb-2 mobile-only-tab-select">
                  <Select value={inventoryPosTab} onValueChange={(value) => setInventoryPosTab(value as "purchase" | "sales" | "inventory" | "stock-movement" | "credit-notes" | "debit-notes" | "gst-report")}>
                    <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent className="rounded-md">
                      <SelectItem value="purchase">Purchase Entry</SelectItem>
                      <SelectItem value="sales">POS Sales</SelectItem>
                      <SelectItem value="inventory">Inventory Report</SelectItem>
                      <SelectItem value="stock-movement">Stock Movement</SelectItem>
                      <SelectItem value="credit-notes">Credit Notes</SelectItem>
                      <SelectItem value="debit-notes">Debit Notes</SelectItem>
                      <SelectItem value="gst-report">GST Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Tabs
                  value={inventoryPosTab}
                  onValueChange={(value) =>
                    setInventoryPosTab(
                      value as "purchase" | "sales" | "inventory" | "stock-movement" | "credit-notes" | "debit-notes" | "gst-report"
                    )
                  }
                >
                  <TabsList className="settings-tabs-list desktop-only-tab-strip">
                    <TabsTrigger value="purchase" className="settings-tabs-trigger">
                      <FilePlus className="h-4 w-4 text-slate-600" />
                      <span>Purchase Entry</span>
                    </TabsTrigger>
                    <TabsTrigger value="sales" className="settings-tabs-trigger">
                      <ShoppingCart className="h-4 w-4 text-slate-600" />
                      <span>POS Sales</span>
                    </TabsTrigger>
                    <TabsTrigger value="inventory" className="settings-tabs-trigger">
                      <Package className="h-4 w-4 text-slate-600" />
                      <span>Inventory Report</span>
                    </TabsTrigger>
                    <TabsTrigger value="stock-movement" className="settings-tabs-trigger">
                      <RotateCcw className="h-4 w-4 text-slate-600" />
                      <span>Stock Movement</span>
                    </TabsTrigger>
                    <TabsTrigger value="credit-notes" className="settings-tabs-trigger">
                      <FileText className="h-4 w-4 text-slate-600" />
                      <span>Credit Notes</span>
                    </TabsTrigger>
                    <TabsTrigger value="debit-notes" className="settings-tabs-trigger">
                      <FileMinus className="h-4 w-4 text-slate-600" />
                      <span>Debit Notes</span>
                    </TabsTrigger>
                    <TabsTrigger value="gst-report" className="settings-tabs-trigger">
                      <Percent className="h-4 w-4 text-slate-600" />
                      <span>GST Report</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {activeItem === "settings" && (
              <div
                className={`global-tabs-wrap ${
                  settingsTab === "shop" ? "is-first" : "is-offset"
                }`}
              >
                <Tabs
                  value={settingsTab}
                  onValueChange={(value) =>
                    setSettingsTab(value as "shop" | "gst-states")
                  }
                >
                  <TabsList className="settings-tabs-list">
                    <TabsTrigger value="shop" className="settings-tabs-trigger">
                      <Store className="h-4 w-4 text-slate-600" />
                      <span>Shop Settings</span>
                    </TabsTrigger>
                    <TabsTrigger value="gst-states" className="settings-tabs-trigger">
                      <MapPin className="h-4 w-4 text-slate-600" />
                      <span>GST States</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {activeItem === "update-job-card" && (
              <JobCardTabStrip value={updateJobCardSubformTab} onValueChange={setUpdateJobCardSubformTab} />
            )}

            {activeItem === "delivered" && (
              <JobCardTabStrip value={readyForDeliverySubformTab} onValueChange={setReadyForDeliverySubformTab} />
            )}

            {activeItem === "maintenance-tracker" && (
              <div className={`global-tabs-wrap ${maintenanceTrackerTab === "all" ? "is-first" : "is-offset"}`}>
                <Tabs value={maintenanceTrackerTab} onValueChange={setMaintenanceTrackerTab}>
                  <div className="mb-2 mobile-only-tab-select">
                    <Select value={maintenanceTrackerTab} onValueChange={setMaintenanceTrackerTab}>
                      <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select section" /></SelectTrigger>
                      <SelectContent className="rounded-md">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="oil">Oil Change</SelectItem>
                        <SelectItem value="filter">Filters</SelectItem>
                        <SelectItem value="general">General Maint.</SelectItem>
                        <SelectItem value="pending">Pending Payments</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <TabsList className="settings-tabs-list desktop-only-tab-strip">
                    <TabsTrigger value="all" className="settings-tabs-trigger"><Calendar className="h-4 w-4 text-slate-600" /><span>All</span></TabsTrigger>
                    <TabsTrigger value="oil" className="settings-tabs-trigger"><Droplets className="h-4 w-4 text-slate-600" /><span>Oil Change</span></TabsTrigger>
                    <TabsTrigger value="filter" className="settings-tabs-trigger"><Filter className="h-4 w-4 text-slate-600" /><span>Filters</span></TabsTrigger>
                    <TabsTrigger value="general" className="settings-tabs-trigger"><Wrench className="h-4 w-4 text-slate-600" /><span>General Maint.</span></TabsTrigger>
                    <TabsTrigger value="pending" className="settings-tabs-trigger"><DollarSign className="h-4 w-4 text-slate-600" /><span>Pending Payments</span></TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Content */}
            {activeItem === "dashboard" ? (
              <DashboardContent onNavigate={handleSelect} role={currentUser.role} />
            ) : activeItem === "new-job-card" ? (
              <div className="global-form-shell fill-height">
                <NewJobCardForm />
              </div>
            ) : activeItem === "update-job-card" ? (
              <div
                className={`global-form-shell fill-height global-tab-form-shell ${
                  updateJobCardSubformTab === "main-form" ? "is-first" : ""
                }`}
              >
                <UpdateJobCardForm
                  activeSubform={updateJobCardSubformTab}
                  selectedJobCardId={selectedJobCardId}
                  searchInputRef={searchInputRef}
                  searchValue={searchValue}
                  onSearchChange={setSearchValue}
                  onJobCardLoaded={(jobCardId) => {
                    setSelectedJobCardId(jobCardId)
                    fetchNavigationRecords()
                  }}
                  onJobCardDeleted={() => {
                    clearSelectedJobCardId()
                    fetchNavigationRecords()
                  }}
                />
              </div>
            ) : activeItem === "delivered" ? (
              <div
                className={`global-form-shell fill-height global-tab-form-shell ${
                  readyForDeliverySubformTab === "main-form" ? "is-first" : ""
                }`}
              >
                <ReadyForDeliveryForm
                  activeSubform={readyForDeliverySubformTab}
                  selectedJobCardId={selectedJobCardId}
                  searchInputRef={searchInputRef}
                  searchValue={searchValue}
                  searchInputFocused={searchInputFocused}
                  onSearchChange={setSearchValue}
                  onJobCardLoaded={(jobCardId) => {
                    setSelectedJobCardId(jobCardId)
                    fetchNavigationRecords({
                      jobcardStatus: "Completed",
                      registrationNumber: deliveredRegistrationFilter,
                      excludeVehicleStatus: "Delivered",
                    })
                  }}
                  onJobCardUpdated={() => {
                    fetchNavigationRecords({
                      jobcardStatus: "Completed",
                      registrationNumber: deliveredRegistrationFilter,
                      excludeVehicleStatus: "Delivered",
                    })
                    clearSelectedJobCardId()
                  }}
                  onRegistrationFilterChange={(registrationNumber) => {
                    setDeliveredRegistrationFilter(registrationNumber)
                    clearSelectedJobCardId()
                  }}
                />
              </div>
            ) : activeItem === "maintenance-tracker" ? (
              <div className={`global-form-shell fill-height global-tab-form-shell ${maintenanceTrackerTab === "all" ? "is-first" : ""}`}>
                <MaintenanceTracker
                  activeTab={maintenanceTrackerTab}
                  onTabChange={setMaintenanceTrackerTab}
                  externalSearch={maintenanceSearch}
                  onExternalSearchChange={setMaintenanceSearch}
                />
              </div>
            ) : activeItem === "employee" ? (
              <div className="global-form-shell fill-height">
                <EmployeeMasterForm
                  searchTerm={employeeSearch}
                  selectedEmployeeId={selectedEmployeeRecordId}
                  onSelectedEmployeeHandled={() => setSelectedEmployeeRecordId(null)}
                  onRecordsCountChange={setEmployeeRecordCount}
                />
              </div>
            ) : activeItem === "attendance-payroll" ? (
              <div className={`global-form-shell fill-height global-tab-form-shell attendance-payroll-shell ${attendancePayrollTab === "attendance" ? "is-first" : ""}`}>
                <AttendancePayrollModule
                  activeTab={attendancePayrollTab}
                  onTabChange={setAttendancePayrollTab}
                  attendanceDate={attendanceDate}
                  onAttendanceDateChange={setAttendanceDate}
                  viewerRole={currentUser.role}
                  currentEmployeeId={currentUser.employeeRefId ?? null}
                  searchTerm={attendancePayrollSearch}
                  onRecordsCountChange={setAttendancePayrollRecordCount}
                />
              </div>
            ) : activeItem === "inventory" ? (
              <div className={`global-form-shell fill-height global-tab-form-shell inventory-shell ${inventoryTab === "suppliers" ? "is-first" : ""}`}>
                <SupplierProductInventoryForm
                  activeTab={inventoryTab}
                  supplierSelectRef={inventorySupplierSelectRef}
                  searchTerm={inventorySearch}
                  onRecordsCountChange={setInventoryRecordCount}
                  onSelectedSupplierSummaryChange={setInventorySelectedSupplierSummary}
                />
              </div>
            ) : activeItem === "inventory-pos" ? (
              <div className={`global-form-shell fill-height global-tab-form-shell inventory-pos-shell ${inventoryPosTab === "purchase" ? "is-first" : ""}`}>
                <InventoryPosModule
                  activeTab={inventoryPosTab}
                  onRecordsCountChange={setInventoryPosRecordCount}
                  onPartiesChange={setInventoryPosParties}
                  searchTerm={inventoryPosSearch}
                />
              </div>
            ) : activeItem === "customers" ? (
              <div className="global-form-shell fill-height global-tab-form-shell is-first">
                <CustomerVehicleManagement
                  initialSearch={customerSearch}
                  onRecordsCountChange={setCustomerRecordCount}
                />
              </div>
            ) : activeItem === "income-expense" ? (
              <div className="global-form-shell fill-height global-tab-form-shell is-first">
                <AccountingMasterForm
                  searchTerm={incomeExpenseSearch}
                  onRecordsCountChange={setIncomeExpenseRecordCount}
                />
              </div>
            ) : activeItem === "spare-parts" ? (
              sparePartsTab === "shops" ? (
                <div className="global-form-shell fill-height global-tab-form-shell">
                  <SparePartShopsForm />
                </div>
              ) : (
                <div className={`global-form-shell fill-height global-tab-form-shell ${sparePartsTab === "all" ? "is-first" : ""}`}>
                  <SparePartsPurchaseLedger
                    activeTab={sparePartsTab}
                    shopID={sparePartsShopFilter}
                    startDate={sparePartsStartDate}
                    endDate={sparePartsEndDate}
                    searchTerm={sparePartsSearch}
                    onRecordsCountChange={setSparePartsRecordCount}
                    onShopFilterChange={setSparePartsShopFilter}
                    onStartDateChange={setSparePartsStartDate}
                    onEndDateChange={setSparePartsEndDate}
                  />
                </div>
              )
            ) : activeItem === "whatsapp-messages" ? (
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                background: "#f0f2f5"
              }}>
                <WhatsAppAdminMessagesComponent onContactChange={setWhatsAppContactName} />
              </div>
            ) : activeItem === "settings" ? (
              <div className={`global-form-shell fill-height global-tab-form-shell ${settingsTab === "shop" ? "is-first" : ""}`}>
                <div className="hide-scrollbar min-h-0 flex-1 overflow-hidden">
                  <div
                    className={`global-tabs-frame settings-no-container ${
                      settingsTab === "shop" ? "is-first" : ""
                    }`}
                  >
                    <SettingsModule activeTab={settingsTab} />
                  </div>
                </div>
              </div>
            ) : activeItem === "all-notifications" ? (
              <div className="global-form-shell fill-height">
                <AllNotificationsModule
                  onNavigate={handleNotificationNavigate}
                  currentEmployeeId={currentUser.role === "technician" ? (currentUser.employeeRefId ?? null) : null}
                />
              </div>
            ) : (
              <PlaceholderContent title={activeLabel} icon={ActiveIcon} />
            )}
              {/* Footer clearance spacer — not needed, footer is now in-flow */}
            </div>
          </div>

          {/* Footer */}
          <footer className={`w-full shrink-0 h-14 bg-white border border-slate-100 px-4 rounded-2xl ${activeItem === "whatsapp-messages" ? "hidden" : ""}`}>
            <div className="flex h-full items-center justify-between gap-4">
              <p className={`text-xs text-muted-foreground ${
                (activeItem === "update-job-card" ||
                 activeItem === "delivered" ||
                 (activeItem === "settings" && settingsTab === "shop") ||
                 (activeItem === "inventory-pos" && (inventoryPosTab === "gst-report" || inventoryPosTab === "purchase" || inventoryPosTab === "sales" || inventoryPosTab === "inventory")) ||
                 (activeItem === "inventory" && inventoryTab === "products"))
                  ? "invisible sm:visible"
                  : ""
              }`}>
                <span className="block md:inline">&copy; {new Date().getFullYear()} AutoFlow Garage Management System |</span>
                <span className="block md:inline">All Rights Reserved.</span>
              </p>
              {activeItem === "settings" && settingsTab === "shop" && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="global-bottom-btn-secondary"
                    onClick={() => window.dispatchEvent(new CustomEvent("shopSettings:reset"))}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-green-600 text-white hover:bg-green-700 gap-2"
                    onClick={() => window.dispatchEvent(new CustomEvent("shopSettings:save"))}
                  >
                    <Save className="h-4 w-4" />
                    Save Settings
                  </Button>
                </div>
              )}
              {activeItem === "update-job-card" && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-green-600 text-white hover:bg-green-700"
                    onClick={() => window.dispatchEvent(new CustomEvent("updateJobCard:save"))}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-9 px-4 text-sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("updateJobCard:delete"))}
                  >
                    Delete
                  </Button>
                </div>
              )}
              {activeItem === "delivered" && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-green-600 text-white hover:bg-green-700"
                    onClick={() => window.dispatchEvent(new CustomEvent("readyForDelivery:save"))}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-9 px-4 text-sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("readyForDelivery:delete"))}
                  >
                    Delete
                  </Button>
                </div>
              )}
              {activeItem === "inventory-pos" && inventoryPosTab === "gst-report" && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-green-600 text-white hover:bg-green-700"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosGst:load"))}
                  >
                    Load Report
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 text-sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosGst:reset"))}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosGst:export"))}
                  >
                    Export Excel (CSV)
                  </Button>
                </div>
              )}
              {activeItem === "inventory" && inventoryTab === "products" && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 text-sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryProducts:clear"))}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-green-600 text-white hover:bg-green-700"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryProducts:save"))}
                  >
                    Save
                  </Button>
                </div>
              )}
              {activeItem === "inventory-pos" && inventoryPosTab === "purchase" && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-9 px-4 text-sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosPurchase:delete"))}
                  >
                    Delete
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-green-600 text-white hover:bg-green-700"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosPurchase:save"))}
                  >
                    Save
                  </Button>
                </div>
              )}
              {activeItem === "inventory-pos" && inventoryPosTab === "sales" && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-9 px-4 text-sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosSales:delete"))}
                  >
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 text-sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosSales:print"))}
                  >
                    Print
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-green-600 text-white hover:bg-green-700"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosSales:save"))}
                  >
                    Save
                  </Button>
                </div>
              )}
              {activeItem === "inventory-pos" && inventoryPosTab === "inventory" && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-sky-600 text-white hover:bg-sky-700"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosInventory:refresh"))}
                  >
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 text-sm bg-amber-500 text-white hover:bg-amber-600"
                    onClick={() => window.dispatchEvent(new CustomEvent("inventoryPosInventory:exportCsv"))}
                  >
                    Export to CSV
                  </Button>
                </div>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <PageContent />
    </Suspense>
  )
}

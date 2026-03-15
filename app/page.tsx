"use client"

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Sidebar, menuItems } from "@/components/dashboard/sidebar"
import { TopHeader } from "@/components/dashboard/top-header"
import { PlaceholderContent } from "@/components/dashboard/placeholder-content"
import { useDropdownKeyboardNav } from "@/hooks/use-dropdown-keyboard-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePickerInput } from "@/components/ui/date-picker-input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  X,
  Search,
  Percent,
} from "lucide-react"

const DashboardContent = dynamic(
  () => import("@/components/dashboard/dashboard-content").then((m) => m.DashboardContent),
  { loading: () => <div className="text-sm text-muted-foreground">Loading dashboard...</div> }
)

const NewJobCardForm = dynamic(
  () => import("@/components/dashboard/new-job-card-form").then((m) => m.NewJobCardForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const UpdateJobCardForm = dynamic(
  () => import("@/components/dashboard/update-job-card-form").then((m) => m.UpdateJobCardForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const ReadyForDeliveryForm = dynamic(
  () => import("@/components/dashboard/ready-for-delivery-form").then((m) => m.ReadyForDeliveryForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const EmployeeMasterForm = dynamic(
  () => import("@/components/dashboard/employee-master-form").then((m) => m.EmployeeMasterForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const AttendancePayrollModule = dynamic(
  () => import("@/components/dashboard/attendance-payroll-module").then((m) => m.AttendancePayrollModule),
  { loading: () => <div className="text-sm text-muted-foreground">Loading module...</div> }
)

const SupplierProductInventoryForm = dynamic(
  () =>
    import("@/components/dashboard/supplier-product-inventory-form").then(
      (m) => m.SupplierProductInventoryForm
    ),
  { loading: () => <div className="text-sm text-muted-foreground">Loading form...</div> }
)

const SparePartsPurchaseLedger = dynamic(
  () => import("@/components/dashboard/spare-parts-purchase-ledger").then((m) => m.SparePartsPurchaseLedger),
  { loading: () => <div className="text-sm text-muted-foreground">Loading ledger...</div> }
)

const CustomerVehicleManagement = dynamic(
  () => import("@/components/dashboard/customer-vehicle-management").then((m) => m.CustomerVehicleManagement),
  { loading: () => <div className="text-sm text-muted-foreground">Loading module...</div> }
)

const InventoryPosModule = dynamic(
  () => import("@/components/dashboard/inventory-pos-module").then((m) => m.InventoryPosModule),
  { loading: () => <div className="text-sm text-muted-foreground">Loading POS...</div> }
)

const AccountingMasterForm = dynamic(
  () => import("@/components/dashboard/accounting-master-form").then((m) => m.AccountingMasterForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading module...</div> }
)

const SettingsModule = dynamic(
  () => import("@/components/settings/settings-module"),
  { loading: () => <div className="text-sm text-muted-foreground">Loading settings...</div> }
)

const MaintenanceTracker = dynamic(
  () => import("@/components/maintenance/maintenance-tracker"),
  { loading: () => <div className="text-sm text-muted-foreground">Loading tracker...</div> }
)

const TechnicianTaskDetailsForm = dynamic(
  () => import("@/components/dashboard/technician-task-details-form").then((m) => m.TechnicianTaskDetailsForm),
  { loading: () => <div className="text-sm text-muted-foreground">Loading task details...</div> }
)

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
  settings: Settings,
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
  settings: "Settings",
}

interface JobCardNavigationItem {
  id: string
  jobCardNumber: string
}

interface EmployeeSearchOption {
  employeeId: number
  empName: string
  mobile: string
  designation: string | null
}

function PageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeItem, setActiveItem] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [navigationRecords, setNavigationRecords] = useState<JobCardNavigationItem[]>([])
  const [deliveredRegistrationFilter, setDeliveredRegistrationFilter] = useState("")
  const [searchValue, setSearchValue] = useState("")
  const [searchInputFocused, setSearchInputFocused] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [employeeSearchResults, setEmployeeSearchResults] = useState<EmployeeSearchOption[]>([])
  const [isEmployeeSearchOpen, setIsEmployeeSearchOpen] = useState(false)
  const [isEmployeeSearchLoading, setIsEmployeeSearchLoading] = useState(false)
  const [selectedEmployeeRecordId, setSelectedEmployeeRecordId] = useState<number | null>(null)
  const [sparePartsTab, setSparePartsTab] = useState<"all" | "returned" | "payments">("all")
  const [attendancePayrollTab, setAttendancePayrollTab] = useState<"attendance" | "adjustments" | "payroll">("attendance")
  const [inventoryTab, setInventoryTab] = useState<"suppliers" | "products">("suppliers")
  const [inventoryPosTab, setInventoryPosTab] = useState<"purchase" | "sales" | "inventory" | "credit-notes" | "debit-notes" | "gst-report">("purchase")
  const [sparePartsShopFilter, setSparePartsShopFilter] = useState("")
  const [sparePartsStartDate, setSparePartsStartDate] = useState("")
  const [sparePartsEndDate, setSparePartsEndDate] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const employeeSearchInputRef = useRef<HTMLInputElement>(null)
  const employeeSearchContainerRef = useRef<HTMLDivElement>(null)
  const employeeSearchDebounceRef = useRef<number | null>(null)

  const selectedJobCardId = searchParams.get("jobCardId") || ""

  const handleSelect = useCallback((id: string) => {
    setActiveItem(id)
    setSidebarOpen(false)
  }, [])

  const ActiveIcon = iconMap[activeItem] || Home
  const activeLabel = labelMap[activeItem] || "Dashboard"

  const currentRecordIndex = useMemo(() => {
    if (!selectedJobCardId) {
      return -1
    }
    return navigationRecords.findIndex((item) => item.id === selectedJobCardId)
  }, [selectedJobCardId, navigationRecords])

  const totalRecords = navigationRecords.length

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

  const handleNavigatePrevious = () => {
    // Navigation removed - only record counter displayed
  }

  const handleNavigateNext = () => {
    // Navigation removed - only record counter displayed
  }

  const loadEmployeeSearchResults = useCallback(async (search: string) => {
    setIsEmployeeSearchLoading(true)

    try {
      const response = await fetch(`/api/employees?search=${encodeURIComponent(search)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch employees")
      }

      setEmployeeSearchResults(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching employee search results:", error)
      setEmployeeSearchResults([])
    } finally {
      setIsEmployeeSearchLoading(false)
    }
  }, [])

  const handleSelectEmployeeSearchResult = useCallback((employee: EmployeeSearchOption) => {
    setEmployeeSearch(employee.empName)
    setSelectedEmployeeRecordId(employee.employeeId)
    setIsEmployeeSearchOpen(false)
    setEmployeeSearchResults([])
  }, [])

  const employeeDropdownNav = useDropdownKeyboardNav({
    itemCount: employeeSearchResults.length,
    isOpen: isEmployeeSearchOpen,
    onSelect: (index) => {
      const employee = employeeSearchResults[index]
      if (employee) {
        handleSelectEmployeeSearchResult(employee)
      }
    },
    onClose: () => setIsEmployeeSearchOpen(false),
  })

  useEffect(() => {
    if (activeItem !== "employee") {
      setIsEmployeeSearchOpen(false)
      setEmployeeSearchResults([])
      setSelectedEmployeeRecordId(null)
      return
    }

    if (!isEmployeeSearchOpen) {
      return
    }

    if (employeeSearchDebounceRef.current) {
      window.clearTimeout(employeeSearchDebounceRef.current)
    }

    employeeSearchDebounceRef.current = window.setTimeout(() => {
      loadEmployeeSearchResults(employeeSearch.trim())
    }, 180)

    return () => {
      if (employeeSearchDebounceRef.current) {
        window.clearTimeout(employeeSearchDebounceRef.current)
      }
    }
  }, [activeItem, employeeSearch, isEmployeeSearchOpen, loadEmployeeSearchResults])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!employeeSearchContainerRef.current?.contains(event.target as Node)) {
        setIsEmployeeSearchOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openEmployeeSearchDropdown = useCallback(() => {
    if (!isEmployeeSearchOpen) {
      setIsEmployeeSearchOpen(true)
      employeeDropdownNav.resetHighlight()
      void loadEmployeeSearchResults(employeeSearch.trim())
    }
  }, [employeeDropdownNav, employeeSearch, isEmployeeSearchOpen, loadEmployeeSearchResults])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
        <div className="relative h-full">
          <Sidebar activeItem={activeItem} onSelect={handleSelect} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopHeader
          onToggleSidebar={() => setSidebarOpen(true)}
          onSettings={() => setActiveItem("settings")}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
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

            {/* Page Heading */}
            {activeItem === "attendance-payroll" ? (
              <div className="mb-3">
                <ActiveIcon className="w-5 h-5 text-muted-foreground inline-block align-middle" />
                <h1 className="text-lg font-heading font-bold text-foreground inline-block align-middle ml-3">{activeLabel}</h1>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <ActiveIcon className="w-5 h-5 text-muted-foreground" />
                  <h1 className="text-lg font-heading font-bold text-foreground">{activeLabel}</h1>
                </div>

                <div className="flex items-end gap-3">
                {activeItem === "update-job-card" && (
                  <div className="flex items-center gap-2 flex-1 max-w-[27.6rem]">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {totalRecords === 0
                        ? "1 of 1"
                        : currentRecordIndex >= 0
                          ? `${currentRecordIndex + 1} of ${totalRecords + 1}`
                          : `${totalRecords + 1} of ${totalRecords + 1}`}
                    </span>
                    <Input
                      ref={searchInputRef}
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
                      placeholder="Search Vehicle"
                      className="h-10 w-96"
                      aria-label="Search Vehicle"
                    />
                  </div>
                )}

                {(activeItem === "delivered") && (
                  <div className="flex items-center gap-2 flex-1 max-w-[27.6rem]">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {totalRecords === 0
                        ? "1 of 1"
                        : currentRecordIndex >= 0
                          ? `${currentRecordIndex + 1} of ${totalRecords + 1}`
                          : `${totalRecords + 1} of ${totalRecords + 1}`}
                    </span>
                    <Input
                      ref={searchInputRef}
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
                      onFocus={() => setSearchInputFocused(true)}
                      onBlur={() => setSearchInputFocused(false)}
                      placeholder="Search Vehicle"
                      className="h-10 w-96"
                      aria-label="Search Vehicle"
                    />
                  </div>
                )}



                {activeItem === "customers" && (
                  <div className="flex items-center gap-2 flex-1 max-w-[27.6rem]">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search customer by name, mobile, vehicle..."
                        className="h-10 w-96 pl-9"
                        aria-label="Search Customer"
                      />
                    </div>
                  </div>
                )}

                {activeItem === "employee" && (
                  <div className="flex items-center gap-2 flex-1 max-w-[27.6rem]">
                    <div ref={employeeSearchContainerRef} className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        ref={employeeSearchInputRef}
                        value={employeeSearch}
                        onChange={(e) => {
                          setEmployeeSearch(e.target.value)
                          if (!isEmployeeSearchOpen) {
                            setIsEmployeeSearchOpen(true)
                          }
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

                          if (isEmployeeSearchOpen) {
                            employeeDropdownNav.handleKeyDown(e)
                          }
                        }}
                        placeholder="Search employee by name, mobile..."
                        className="h-10 w-96 pl-9"
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
                                  onMouseDown={(event) => event.preventDefault()}
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
                )}
                </div>
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
                  <TabsList className="global-tabs-list">
                    <TabsTrigger value="attendance">Mobile Attendance</TabsTrigger>
                    <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
                    <TabsTrigger value="payroll">Payroll</TabsTrigger>
                  </TabsList>
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
                  onValueChange={(value) => setSparePartsTab(value as "all" | "returned" | "payments")}
                >
                  <TabsList className="global-tabs-list">
                    <TabsTrigger value="all">All Records</TabsTrigger>
                    <TabsTrigger value="returned">Returned Bills</TabsTrigger>
                    <TabsTrigger value="payments">Bill Payments</TabsTrigger>
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
                <Tabs
                  value={inventoryTab}
                  onValueChange={(value) => setInventoryTab(value as "suppliers" | "products")}
                >
                  <TabsList className="global-tabs-list">
                    <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {activeItem === "inventory-pos" && (
              <div
                className={`global-tabs-wrap ${
                  inventoryPosTab === "purchase" ? "is-first" : "is-offset"
                }`}
              >
                <Tabs
                  value={inventoryPosTab}
                  onValueChange={(value) =>
                    setInventoryPosTab(
                      value as "purchase" | "sales" | "inventory" | "credit-notes" | "debit-notes" | "gst-report"
                    )
                  }
                >
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 border-b-0">
                    <TabsTrigger value="purchase" className="w-full gap-2">
                      <FilePlus className="h-4 w-4 text-slate-600" />
                      <span>Purchase Entry</span>
                    </TabsTrigger>
                    <TabsTrigger value="sales" className="w-full gap-2">
                      <ShoppingCart className="h-4 w-4 text-slate-600" />
                      <span>POS Sales</span>
                    </TabsTrigger>
                    <TabsTrigger value="inventory" className="w-full gap-2">
                      <Package className="h-4 w-4 text-slate-600" />
                      <span>Inventory Report</span>
                    </TabsTrigger>
                    <TabsTrigger value="credit-notes" className="w-full gap-2">
                      <FileText className="h-4 w-4 text-slate-600" />
                      <span>Credit Notes</span>
                    </TabsTrigger>
                    <TabsTrigger value="debit-notes" className="w-full gap-2">
                      <FileMinus className="h-4 w-4 text-slate-600" />
                      <span>Debit Notes</span>
                    </TabsTrigger>
                    <TabsTrigger value="gst-report" className="w-full gap-2">
                      <Percent className="h-4 w-4 text-slate-600" />
                      <span>GST Report</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
            {/* Content */}
            {activeItem === "dashboard" ? (
              <DashboardContent onNavigate={handleSelect} />
            ) : activeItem === "new-job-card" ? (
              <div className="bg-white rounded-lg border border-border p-6">
                <NewJobCardForm />
              </div>
            ) : activeItem === "update-job-card" ? (
              <div className="bg-white rounded-lg border border-border p-6">
                <UpdateJobCardForm
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
            ) : activeItem === "technician-task-details" ? (
              <div className="bg-white rounded-lg border border-border p-6">
                <TechnicianTaskDetailsForm />
              </div>
            ) : activeItem === "delivered" ? (
              <div className="bg-white rounded-lg border border-border p-6">
                <ReadyForDeliveryForm
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
              <MaintenanceTracker />
            ) : activeItem === "employee" ? (
              <div className="bg-white rounded-lg border border-border p-6">
                <EmployeeMasterForm
                  searchTerm={employeeSearch}
                  selectedEmployeeId={selectedEmployeeRecordId}
                  onSelectedEmployeeHandled={() => setSelectedEmployeeRecordId(null)}
                />
              </div>
            ) : activeItem === "attendance-payroll" ? (
              <div
                className={`global-tabs-frame ${
                  attendancePayrollTab === "attendance" ? "is-first" : "is-offset"
                }`}
              >
                <AttendancePayrollModule
                  activeTab={attendancePayrollTab}
                  onTabChange={setAttendancePayrollTab}
                />
              </div>
            ) : activeItem === "inventory" ? (
              <div
                className={`global-tabs-frame ${
                  inventoryTab === "suppliers" ? "is-first" : "is-offset"
                }`}
              >
                <SupplierProductInventoryForm activeTab={inventoryTab} />
              </div>
            ) : activeItem === "inventory-pos" ? (
              <div
                className={`global-tabs-frame ${
                  inventoryPosTab === "purchase" ? "is-first" : inventoryPosTab === "gst-report" ? "is-last" : ""
                }`}
              >
                <InventoryPosModule activeTab={inventoryPosTab} />
              </div>
            ) : activeItem === "customers" ? (
              <div className="bg-white rounded-lg border border-border p-6">
                <CustomerVehicleManagement initialSearch={customerSearch} />
              </div>
            ) : activeItem === "income-expense" ? (
              <div className="bg-white rounded-lg border border-border p-6">
                <AccountingMasterForm />
              </div>
            ) : activeItem === "spare-parts" ? (
              <div
                className={`global-tabs-frame ${
                  sparePartsTab === "all" ? "is-first" : "is-offset"
                }`}
              >
                <SparePartsPurchaseLedger
                  activeTab={sparePartsTab}
                  shopID={sparePartsShopFilter}
                  startDate={sparePartsStartDate}
                  endDate={sparePartsEndDate}
                  onShopFilterChange={setSparePartsShopFilter}
                  onStartDateChange={setSparePartsStartDate}
                  onEndDateChange={setSparePartsEndDate}
                />
              </div>
            ) : activeItem === "settings" ? (
              <div className="bg-white rounded-lg border border-border p-6">
                <SettingsModule />
              </div>
            ) : (
              <PlaceholderContent title={activeLabel} icon={ActiveIcon} />
            )}
          </div>

          {/* Footer */}
          <footer className="px-6 py-4 mt-6 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
              &copy; 2025 Garage Management System | All Rights Reserved.
            </p>
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

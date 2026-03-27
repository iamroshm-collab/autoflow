"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Search, FileText, Printer, Calendar, Droplets, Filter, Wrench, DollarSign } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { notify } from "@/components/ui/notify"

interface VehicleSearchResult {
  vehicleId: string
  registrationNumber: string
  make: string
  model: string
  customerId: string
  customerName: string
  mobileNo: string
}

interface ServiceDescriptionRow {
  id: string
  description: string
  sl: number
}

interface SparePart {
  id: string
  shopName: string
  billNumber: string
  itemDescription: string | null
  amount: number
  billDate?: string | null
}

interface EmployeeEarning {
  id: string
  employee: string
  workType: string | null
  amount: number
}

interface DeliveredJobCard {
  id: string
  deliveryDate?: string | null
  jobCardNumber: string
  maintenanceType?: string | null
  kmDriven?: number | null
  vehicleStatus?: string | null
  jobcardPaymentStatus?: string | null
  customer: {
    id: string
    name: string
    mobileNo: string
  }
  vehicle: {
    id: string
    registrationNumber: string
    make: string
    model: string
  }
  serviceDescriptions: ServiceDescriptionRow[]
  sparePartsBills?: SparePart[]
  employeeEarnings?: EmployeeEarning[]
}

interface MaintenanceRecord {
  jobCard: DeliveredJobCard
  matchedDescriptions: ServiceDescriptionRow[]
  category: "oil" | "filter" | "general" | "all" | "pending"
}

const normalizeMaintenanceType = (value?: string | null): "oil" | "filter" | "general" | null => {
  const v = (value || "").toLowerCase()
  if (!v) return null
  if (v.includes("oil")) return "oil"
  if (v.includes("filter")) return "filter"
  if (v.includes("general") || v.includes("maint")) return "general"
  return null
}

const filterMaintenanceVehicles = (jobcards: DeliveredJobCard[]): MaintenanceRecord[] => {
  return jobcards
    .map((jobCard) => {
      const selectedType = normalizeMaintenanceType(jobCard.maintenanceType)
      const descriptions = jobCard.serviceDescriptions || []

      const records: MaintenanceRecord[] = [
        {
          jobCard,
          matchedDescriptions: descriptions,
          category: "all",
        },
      ]

      if (selectedType) {
        records.push({
          jobCard,
          matchedDescriptions: descriptions,
          category: selectedType,
        })
      }

      // Add to pending payments if payment status is Partial
      if (jobCard.jobcardPaymentStatus?.toLowerCase() === "partial") {
        records.push({
          jobCard,
          matchedDescriptions: descriptions,
          category: "pending",
        })
      }

      return records
    })
    .flat()
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-GB")
}

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

export default function MaintenanceTracker({
  externalSearch,
  onExternalSearchChange,
}: {
  externalSearch?: string
  onExternalSearchChange?: (value: string) => void
} = {}) {
  const [jobcards, setJobcards] = useState<DeliveredJobCard[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const effectiveSearchTerm = externalSearch !== undefined ? externalSearch : searchTerm
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("/api/maintenance/tracker", { next: { revalidate: 60 } })
        if (!response.ok) throw new Error("Failed to fetch maintenance data")

        const data = await response.json()
        setJobcards(data)
      } catch (error) {
        console.error("Error fetching maintenance data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  // Get unique vehicles sorted by most recent delivery date
  const uniqueVehiclesByDelivery = useMemo(() => {
    const vehicleMap = new Map<string, VehicleSearchResult & { deliveryDate: string | null }>()
    
    jobcards.forEach((jc) => {
      const vehicleKey = jc.vehicle?.registrationNumber || ""
      
      // Keep only the most recent delivery for each vehicle
      if (vehicleKey) {
        if (!vehicleMap.has(vehicleKey) || 
            (jc.deliveryDate && vehicleMap.get(vehicleKey)?.deliveryDate && 
             new Date(jc.deliveryDate) > new Date(vehicleMap.get(vehicleKey)?.deliveryDate || ""))) {
          vehicleMap.set(vehicleKey, {
            vehicleId: jc.vehicle?.id || "",
            registrationNumber: jc.vehicle?.registrationNumber || "",
            make: jc.vehicle?.make || "",
            model: jc.vehicle?.model || "",
            customerId: jc.customer?.id || "",
            customerName: jc.customer?.name || "",
            mobileNo: jc.customer?.mobileNo || "",
            deliveryDate: jc.deliveryDate || null,
          })
        }
      }
    })
    
    // Sort by most recent delivery date (last delivered on top)
    return Array.from(vehicleMap.values()).sort((a, b) => {
      const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0
      const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0
      return dateB - dateA
    })
  }, [jobcards])

  // Get filtered vehicles and customers for dropdown based on search term
  const dropdownVehicles = useMemo(() => {
    const query = effectiveSearchTerm.trim().toLowerCase()
    if (!query) return []

    const resultsMap = new Map<string, VehicleSearchResult>()
    
    jobcards.forEach((jc) => {
      const regNo = jc.vehicle?.registrationNumber?.toLowerCase() || ""
      const makeModel = `${jc.vehicle?.make || ""} ${jc.vehicle?.model || ""}`.toLowerCase()
      const customerName = jc.customer?.name?.toLowerCase() || ""
      const mobileNo = jc.customer?.mobileNo?.toLowerCase() || ""
      
      // Check if any field contains the search term
      if (
        regNo.includes(query) || 
        makeModel.includes(query) || 
        customerName.includes(query) ||
        mobileNo.includes(query)
      ) {
        const key = `${jc.vehicle?.id}-${jc.customer?.id}`
        if (!resultsMap.has(key)) {
          resultsMap.set(key, {
            vehicleId: jc.vehicle?.id || "",
            registrationNumber: jc.vehicle?.registrationNumber || "",
            make: jc.vehicle?.make || "",
            model: jc.vehicle?.model || "",
            customerId: jc.customer?.id || "",
            customerName: jc.customer?.name || "",
            mobileNo: jc.customer?.mobileNo || "",
          })
        }
      }
    })
    
    return Array.from(resultsMap.values())
  }, [jobcards, effectiveSearchTerm])

  function handleSelectVehicle(result: VehicleSearchResult) {
    const combined = `${result.registrationNumber} ${result.customerName}`
    if (externalSearch !== undefined && onExternalSearchChange) {
      onExternalSearchChange(combined)
    } else {
      setSearchTerm(combined)
    }
    setShowDropdown(false)
    setHighlightIndex(0)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) {
      if (e.key === "ArrowDown" && effectiveSearchTerm.trim().length > 0) {
        setShowDropdown(true)
        setHighlightIndex(0)
      }
      return
    }

    // Get the appropriate list to navigate
    const items = effectiveSearchTerm.trim().length > 0 ? dropdownVehicles : uniqueVehiclesByDelivery
    
    if (items.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (effectiveSearchTerm.trim().length > 0) {
        const vehicle = dropdownVehicles[highlightIndex]
        if (vehicle) handleSelectVehicle(vehicle)
      } else {
        const vehicle = uniqueVehiclesByDelivery[highlightIndex]
        if (vehicle) {
          if (externalSearch !== undefined && onExternalSearchChange) {
            onExternalSearchChange(vehicle.registrationNumber)
          } else {
            setSearchTerm(vehicle.registrationNumber)
          }
          setShowDropdown(false)
          setHighlightIndex(0)
        }
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false)
    }
  }

  const filteredJobcards = useMemo(() => {
    const query = effectiveSearchTerm.trim().toLowerCase()
    if (!query) return jobcards

    const tokens = query.split(/\s+/).filter(Boolean)

    const filtered = jobcards.filter((jc) => {
      const customer = jc.customer?.name?.toLowerCase() || ""
      const regNo = jc.vehicle?.registrationNumber?.toLowerCase() || ""
      const makeModel = `${jc.vehicle?.make || ""} ${jc.vehicle?.model || ""}`.toLowerCase()
      const maintenanceType = (jc.maintenanceType || "").toLowerCase()
      const serviceText = (jc.serviceDescriptions || [])
        .map((d) => d.description || "")
        .join(" ")
        .toLowerCase()

      const searchable = `${customer} ${regNo} ${makeModel} ${maintenanceType} ${serviceText}`
      const searchableNormalized = normalizeText(searchable)

      const matches = tokens.every((token) => {
        const tokenNormalized = normalizeText(token)
        const result = searchable.includes(token) || searchableNormalized.includes(tokenNormalized)
        if (!result && searchTerm === "k") {
          console.log("No match for:", token, "in:", { customer, regNo, makeModel, maintenanceType })
        }
        return result
      })

      return matches
    })

    console.log("Search term:", searchTerm, "Total jobcards:", jobcards.length, "Filtered:", filtered.length)
    if (searchTerm === "k") {
      console.log("Sample data:", jobcards.slice(0, 2).map(jc => ({
        customer: jc.customer?.name,
        regNo: jc.vehicle?.registrationNumber,
        make: jc.vehicle?.make,
        model: jc.vehicle?.model
      })))
    }
    return filtered
  }, [jobcards, effectiveSearchTerm])

  const records = useMemo(() => filterMaintenanceVehicles(filteredJobcards), [filteredJobcards])

  const oilRecords = records.filter((r) => r.category === "oil")
  const filterRecords = records.filter((r) => r.category === "filter")
  const generalRecords = records.filter((r) => r.category === "general")
  const allRecords = records.filter((r) => r.category === "all")
  const pendingRecords = records.filter((r) => r.category === "pending")

  const handlePrintJobCard = async (record: MaintenanceRecord) => {
    try {
      let shopSettings = {
        shopName: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        phone1: "",
        phone2: "",
        email: "",
        gstin: "",
        website: "",
        upiId: "",
      }

      try {
        const shopSettingsResponse = await fetch("/api/settings/shop", { cache: "no-store" })
        if (shopSettingsResponse.ok) {
          const data = await shopSettingsResponse.json()
          shopSettings = {
            shopName: String(data?.shopName || ""),
            address: data?.address || "",
            city: data?.city || "",
            state: data?.state || "",
            pincode: data?.pincode || "",
            phone1: data?.phone1 || "",
            phone2: data?.phone2 || "",
            email: data?.email || "",
            gstin: data?.gstin || "",
            website: data?.website || "",
            upiId: data?.upiId || "",
          }
        }
      } catch (settingsError) {
        console.warn("Unable to load shop settings for PDF", settingsError)
      }

      const payload = {
        jobCardNumber: record.jobCard.jobCardNumber,
        serviceId: record.jobCard.id,
        customerName: record.jobCard.customer.name,
        customerMobile: record.jobCard.customer.mobileNo,
        registrationNumber: record.jobCard.vehicle.registrationNumber,
        vehicleModel: `${record.jobCard.vehicle.make} ${record.jobCard.vehicle.model}`,
        kmDriven: String(record.jobCard.kmDriven || ""),
        deliveryDate: formatDate(record.jobCard.deliveryDate) || "",
        nextServiceDate: "",
        nextServiceKM: "",
        total: 0,
        discount: 0,
        advance: 0,
        grandTotal: 0,
        paidAmount: 0,
        balance: 0,
        services: record.jobCard.serviceDescriptions.map((desc) => ({
          description: desc.description,
          quantity: 1,
          unit: "Service",
          amount: 0,
        })),
        spareParts: record.jobCard.sparePartsBills?.map((spare) => ({
          item: spare.itemDescription || "Item",
          billNumber: spare.billNumber,
          amount: spare.amount,
        })),
        shopSettings,
      }
      
      const { generateDeliveredJobCardPdf } = await import("@/lib/delivered-jobcard-pdf")
      await generateDeliveredJobCardPdf(payload)
    } catch (error) {
      console.error("Error generating PDF:", error)
    }
  }

  const handleVehicleStatusChange = async (jobCardId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/jobcards/${jobCardId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleStatus: newStatus,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update vehicle status")
      }

      // Update the local state
      setJobcards((prev) =>
        prev.map((jc) =>
          jc.id === jobCardId ? { ...jc, vehicleStatus: newStatus } : jc
        )
      )

      notify.success("Vehicle status updated successfully")
    } catch (error) {
      console.error("Error updating vehicle status:", error)
      notify.error(error instanceof Error ? error.message : "Failed to update vehicle status")
    }
  }

  const handlePaymentStatusChange = async (jobCardId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/jobcards/${jobCardId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobcardPaymentStatus: newStatus,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update payment status")
      }

      // Update the local state
      setJobcards((prev) =>
        prev.map((jc) =>
          jc.id === jobCardId ? { ...jc, jobcardPaymentStatus: newStatus } : jc
        )
      )

      notify.success("Payment status updated successfully")
    } catch (error) {
      console.error("Error updating payment status:", error)
      notify.error(error instanceof Error ? error.message : "Failed to update payment status")
    }
  }

  const MaintenanceTable = ({ data, showPaymentStatus = false, showBothStatuses = false }: { data: MaintenanceRecord[], showPaymentStatus?: boolean, showBothStatuses?: boolean }) => (
    <div className="global-form-shell">
      <div className="overflow-x-auto border rounded-lg bg-white">
        <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            <TableHead className="text-center">Delivery Date</TableHead>
            <TableHead className="text-center">Customer Name</TableHead>
            <TableHead className="text-center">Mobile Number</TableHead>
            <TableHead className="text-center">Vehicle</TableHead>
            {showBothStatuses ? (
              <>
                <TableHead className="text-center">Vehicle Status</TableHead>
                <TableHead className="text-center">Payment Status</TableHead>
              </>
            ) : (
              <TableHead className="text-center">{showPaymentStatus ? "Payment Status" : "Vehicle Status"}</TableHead>
            )}
            <TableHead className="text-center">JobCard Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showBothStatuses ? 7 : 6} className="text-center py-8 text-muted-foreground">
                No records found
              </TableCell>
            </TableRow>
          ) : (
            data.map((record, idx) => (
              <TableRow key={`${record.jobCard.id}-${idx}`} className="hover:bg-muted/50">
                <TableCell className="font-medium text-sm text-center">
                  {formatDate(record.jobCard.deliveryDate)}
                </TableCell>
                <TableCell className="text-sm text-center">{record.jobCard.customer.name}</TableCell>
                <TableCell className="text-sm text-center">{record.jobCard.customer.mobileNo}</TableCell>
                <TableCell className="text-sm text-center">
                  {record.jobCard.vehicle.make} {record.jobCard.vehicle.model}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {record.jobCard.vehicle.registrationNumber}
                  </span>
                </TableCell>
                {showBothStatuses ? (
                  <>
                    <TableCell className="text-sm text-center">
                      <Select
                        value={record.jobCard.vehicleStatus || "Pending"}
                        onValueChange={(value) =>
                          handleVehicleStatusChange(record.jobCard.id, value)
                        }
                      >
                        <div className="flex justify-center">
                          <SelectTrigger className="h-8 text-sm w-auto">
                            <SelectValue />
                          </SelectTrigger>
                        </div>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Delivered">Delivered</SelectItem>
                          <SelectItem value="Ready">Ready</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      <Select
                        value={record.jobCard.jobcardPaymentStatus || "Partial"}
                        onValueChange={(value) =>
                          handlePaymentStatusChange(record.jobCard.id, value)
                        }
                      >
                        <div className="flex justify-center">
                          <SelectTrigger className="h-8 text-sm w-auto">
                            <SelectValue />
                          </SelectTrigger>
                        </div>
                        <SelectContent>
                          <SelectItem value="Partial">Partial</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </>
                ) : (
                  <TableCell className="text-sm text-center">
                    {showPaymentStatus ? (
                      <Select
                        value={record.jobCard.jobcardPaymentStatus || "Partial"}
                        onValueChange={(value) =>
                          handlePaymentStatusChange(record.jobCard.id, value)
                        }
                      >
                        <div className="flex justify-center">
                          <SelectTrigger className="h-8 text-sm w-auto">
                            <SelectValue />
                          </SelectTrigger>
                        </div>
                        <SelectContent>
                          <SelectItem value="Partial">Partial</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={record.jobCard.vehicleStatus || "Pending"}
                        onValueChange={(value) =>
                          handleVehicleStatusChange(record.jobCard.id, value)
                        }
                      >
                        <div className="flex justify-center">
                          <SelectTrigger className="h-8 text-sm w-auto">
                            <SelectValue />
                          </SelectTrigger>
                        </div>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Delivered">Delivered</SelectItem>
                          <SelectItem value="Ready">Ready</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-sm text-center">
                  {record.matchedDescriptions.length === 0 ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRecord(record)
                        setIsDialogOpen(true)
                      }}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      View
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {externalSearch === undefined && (
      <div className="flex justify-end -mt-[3.5rem] mb-6">
        <div className="relative w-96" ref={containerRef}>
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id="search"
          placeholder="Search customer or vehicle..."
          value={searchTerm}
          onChange={(e) => {
            const v = e.target.value
            setSearchTerm(v)
            if (v.trim().length > 0) setShowDropdown(true)
            else setShowDropdown(false)
            setHighlightIndex(0)
          }}
          onFocus={() => {
            setShowDropdown(true)
          }}
          onKeyDown={onKeyDown}
          className="pl-10"
        />

              {/* Dropdown menu - show filtered vehicles in search results, or all unique vehicles sorted by delivery date */}
              {showDropdown && (
                <div className="absolute left-0 right-0 mt-1 z-50 dropdown-scroll">
                  {/* If search term exists, show filtered results */}
                  {searchTerm.trim().length > 0 && dropdownVehicles.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-muted text-xs font-semibold text-muted-foreground sticky top-0">
                        Search Results
                    </div>
                      {dropdownVehicles.map((result, i) => (
                        <button
                          key={`${result.vehicleId}-${result.customerId}`}
                          role="option"
                          aria-selected={i === highlightIndex}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectVehicle(result)}
                          onMouseEnter={() => setHighlightIndex(i)}
                          className={`dropdown-item ${i === highlightIndex ? 'selected' : ''}`}
                        >
                          <div className="font-medium text-sm">{result.registrationNumber}</div>
                          <div className="text-xs text-muted-foreground">{result.make} {result.model}</div>
                          <div className="text-xs text-gray-700 mt-1">{result.customerName}</div>
                          <div className="text-xs text-gray-500">{result.mobileNo}</div>
                        </button>
                      ))}
                    </>
                  )}
                  
                  {/* If no search term or no search results, show all unique vehicles by delivery date */}
                  {(searchTerm.trim().length === 0 || dropdownVehicles.length === 0) && uniqueVehiclesByDelivery.length > 0 && (
                    <>
                      {uniqueVehiclesByDelivery.map((vehicle, i) => (
                        <button
                          key={`${vehicle.vehicleId}-${vehicle.registrationNumber}`}
                          role="option"
                          aria-selected={i === highlightIndex}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSearchTerm(vehicle.registrationNumber)
                            setShowDropdown(false)
                            setHighlightIndex(0)
                          }}
                          onMouseEnter={() => setHighlightIndex(i)}
                          className={`dropdown-item ${i === highlightIndex ? 'selected' : ''}`}
                        >
                          <div className="font-medium text-sm">{vehicle.registrationNumber}</div>
                          <div className="text-xs text-muted-foreground">{vehicle.make} {vehicle.model}</div>
                          <div className="text-xs text-gray-700 mt-1">
                            {vehicle.customerName} <span className="text-gray-500">({vehicle.mobileNo})</span>
                          </div>
                          {vehicle.deliveryDate && (
                            <div className="text-xs text-gray-500 mt-1">
                              Last delivered: {formatDate(vehicle.deliveryDate)}
                            </div>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  
                  {uniqueVehiclesByDelivery.length === 0 && dropdownVehicles.length === 0 && (
                    <div className="px-4 py-3 text-center text-xs text-muted-foreground">
                      No vehicles found
                    </div>
                  )}
                </div>
              )}
        </div>
      </div>
      )}

      <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger
              value="all"
              className="flex items-center gap-2 [&>svg]:text-slate-500 data-[state=active]:[&>svg]:text-sky-600"
            >
              <Calendar className="h-4 w-4" />
              All
            </TabsTrigger>
            <TabsTrigger
              value="oil"
              className="flex items-center gap-2 [&>svg]:text-slate-500 data-[state=active]:[&>svg]:text-sky-600"
            >
              <Droplets className="h-4 w-4" />
              Oil Change
            </TabsTrigger>
            <TabsTrigger
              value="filter"
              className="flex items-center gap-2 [&>svg]:text-slate-500 data-[state=active]:[&>svg]:text-sky-600"
            >
              <Filter className="h-4 w-4" />
              Filters
            </TabsTrigger>
            <TabsTrigger
              value="general"
              className="flex items-center gap-2 [&>svg]:text-slate-500 data-[state=active]:[&>svg]:text-sky-600"
            >
              <Wrench className="h-4 w-4" />
              General Maint.
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="flex items-center gap-2 [&>svg]:text-slate-500 data-[state=active]:[&>svg]:text-sky-600"
            >
              <DollarSign className="h-4 w-4" />
              Pending Payments
            </TabsTrigger>
          </TabsList>

          <div className="pt-6">
            <TabsContent value="all" className="mt-0">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <MaintenanceTable data={allRecords} showBothStatuses={true} />
              )}
            </TabsContent>

            <TabsContent value="oil" className="mt-0">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <MaintenanceTable data={oilRecords} />
              )}
            </TabsContent>

            <TabsContent value="filter" className="mt-0">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <MaintenanceTable data={filterRecords} />
              )}
            </TabsContent>

            <TabsContent value="general" className="mt-0">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <MaintenanceTable data={generalRecords} />
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-0">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <MaintenanceTable data={pendingRecords} showPaymentStatus={true} />
              )}
            </TabsContent>
          </div>
        </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] flex flex-col p-0"
        >
          <div className="overflow-y-auto flex-1 px-6 pt-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">Job Card Details</DialogTitle>
            </DialogHeader>
            
            {selectedRecord && (
              <div className="space-y-6 pb-6">
                {/* Header Section */}
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Job Card #</p>
                      <p className="text-sm font-bold">{selectedRecord.jobCard.jobCardNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Delivery Date</p>
                      <p className="text-sm font-medium">{formatDate(selectedRecord.jobCard.deliveryDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Maintenance Type</p>
                      <p className="text-sm font-medium">{selectedRecord.jobCard.maintenanceType || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">ODO Reading</p>
                      <p className="text-sm font-medium">{selectedRecord.jobCard.kmDriven ? `${selectedRecord.jobCard.kmDriven} km` : "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Customer & Vehicle Section */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-semibold text-sm mb-3">Customer Information</h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="text-sm font-medium">{selectedRecord.jobCard.customer.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Mobile</p>
                        <p className="text-sm font-medium">{selectedRecord.jobCard.customer.mobileNo}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-semibold text-sm mb-3">Vehicle Information</h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Registration</p>
                        <p className="text-sm font-medium">{selectedRecord.jobCard.vehicle.registrationNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Model</p>
                        <p className="text-sm font-medium">{selectedRecord.jobCard.vehicle.make} {selectedRecord.jobCard.vehicle.model}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Services Section */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                    <span className="w-1 h-5 bg-primary rounded-full"></span>
                    Services Done
                  </h3>
                  {selectedRecord.matchedDescriptions.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedRecord.matchedDescriptions.map((desc) => (
                        <li key={desc.id} className="text-sm">
                          {desc.description}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No services recorded</p>
                  )}
                </div>

                {/* Spare Parts Section */}
                {selectedRecord.jobCard.sparePartsBills && selectedRecord.jobCard.sparePartsBills.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                      <span className="w-1 h-5 bg-primary rounded-full"></span>
                      Spare Parts Used
                    </h3>
                    <div className="space-y-3">
                      {selectedRecord.jobCard.sparePartsBills.map((spare) => (
                        <div key={spare.id} className="bg-muted/50 p-3 rounded">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-sm font-medium">{spare.itemDescription || "Item"}</p>
                              <p className="text-xs text-muted-foreground">Bill: {spare.billNumber}</p>
                            </div>
                            <p className="text-sm font-semibold">₹{spare.amount.toFixed(2)}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{spare.shopName}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Employee/Technician Section */}
                {selectedRecord.jobCard.employeeEarnings && selectedRecord.jobCard.employeeEarnings.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                      <span className="w-1 h-5 bg-primary rounded-full"></span>
                      Technicians Attended
                    </h3>
                    <div className="grid gap-2">
                      {selectedRecord.jobCard.employeeEarnings.map((earning) => (
                        <div key={earning.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                          <div>
                            <p className="text-sm font-medium">{earning.employee}</p>
                            {earning.workType && <p className="text-xs text-muted-foreground">{earning.workType}</p>}
                          </div>
                          <p className="text-sm font-semibold">₹{earning.amount.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Fixed Footer with Print Button */}
          <div className="border-t bg-background px-6 py-4 mt-auto flex justify-center">
            <Button
              variant="ghost"
              onClick={() => selectedRecord && handlePrintJobCard(selectedRecord)}
              className="gap-2 bg-blue-100 text-blue-600 hover:bg-orange-100 hover:text-orange-600"
            >
              <Printer className="h-4 w-4" />
              Print Job Card
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

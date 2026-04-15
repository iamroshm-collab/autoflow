"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CarFront, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { successAction, errorAction } from "@/lib/action-feedback"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getMobileValidationMessage, normalizeMobileNumber } from "@/lib/mobile-validation"
import { composeAddress, parseAddress } from "@/lib/address-utils"
import useContinuousRows from '@/components/hooks/useContinuousRows'

interface VehicleRow {
  id: string
  registrationNumber: string
  make: string
  model: string
  createdAt?: string
  isNew?: boolean
}

interface CustomerRecord {
  id: string
  name: string
  mobileNo: string
  address: string | null
  state: string | null
  gstin: string | null
  pan: string | null
  vehicles?: VehicleRow[]
  matchedBy?: string
}

interface CustomerForm {
  name: string
  mobileNo: string
  addressLine1: string
  addressLine2: string
  city: string
  district: string
  postalCode: string
  state: string
  gstin: string
  pan: string
}

const defaultCustomerForm = (): CustomerForm => ({
  name: "",
  mobileNo: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  postalCode: "",
  state: "",
  gstin: "",
  pan: "",
})

const emptyVehicle = (): VehicleRow => ({
  id: `temp-${Date.now()}-${Math.random()}`,
  registrationNumber: "",
  make: "",
  model: "",
  createdAt: "",
  isNew: true,
})

const isVehicleRowTouched = (row: VehicleRow) =>
  Boolean(row.registrationNumber.trim() || row.make.trim() || row.model.trim())

interface CustomerVehicleManagementProps {
  initialSearch?: string
  onRecordsCountChange?: (count: number) => void
}

export function CustomerVehicleManagement({
  initialSearch = "",
  onRecordsCountChange,
}: CustomerVehicleManagementProps) {
  const [globalSearch, setGlobalSearch] = useState(initialSearch)
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false)
  const [isLoadingModalData, setIsLoadingModalData] = useState(false)
  const debounceRef = useRef<number | null>(null)

  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [customerForm, setCustomerForm] = useState<CustomerForm>(defaultCustomerForm)
  const { rows: vehicles, updateRow: updateVehicleRow, setRows: setVehicles } = useContinuousRows<VehicleRow>(() => emptyVehicle(), [], { autoAppend: false })

  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [isSavingVehicles, setIsSavingVehicles] = useState(false)
  const [deleteCustomerDialog, setDeleteCustomerDialog] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<CustomerRecord | null>(null)
  const [mobileError, setMobileError] = useState<string>("")
  const [editableVehicleRowIds, setEditableVehicleRowIds] = useState<Set<string>>(new Set())
  const [shopStateCode, setShopStateCode] = useState<string>("")

  // Fetch shop settings to get default state code
  useEffect(() => {
    const fetchShopSettings = async () => {
      try {
        const response = await fetch("/api/settings/shop")
        const data = await response.json()
        setShopStateCode(String(data?.stateId ?? ""))
      } catch (error) {
        console.error("Error fetching shop settings:", error)
      }
    }
    fetchShopSettings()
  }, [])

  const loadCustomers = useCallback(async (searchValue: string) => {
    setIsLoadingCustomers(true)
    try {
      const response = await fetch(`/api/customers?search=${encodeURIComponent(searchValue.trim())}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load customers")
      }

      setCustomers(Array.isArray(data) ? (data as CustomerRecord[]) : [])
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to load customers")
      setCustomers([])
    } finally {
      setIsLoadingCustomers(false)
    }
  }, [])

  const fetchCustomerById = useCallback(async (customerId: string) => {
    const response = await fetch(`/api/customers/${customerId}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Failed to load customer")
    }

    return data
  }, [])

  // Sync initialSearch prop to globalSearch state
  useEffect(() => {
    setGlobalSearch(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)

    debounceRef.current = window.setTimeout(() => {
      void loadCustomers(globalSearch)
    }, 220)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [globalSearch, loadCustomers])

  useEffect(() => {
    onRecordsCountChange?.(customers.length)
  }, [customers.length, onRecordsCountChange])

  const loadCustomer = async (customerId: string) => {
    try {
      const data = await fetchCustomerById(customerId)

      setSelectedCustomerId(data.id)
      const parsedAddress = parseAddress(data.address)
      setCustomerForm({
        name: data.name || "",
        mobileNo: data.mobileNo || "",
        addressLine1: parsedAddress.line1,
        addressLine2: parsedAddress.line2,
        city: parsedAddress.city,
        district: parsedAddress.district,
        postalCode: parsedAddress.postalCode,
        state: data.state || "",
        gstin: data.gstin || "",
        pan: data.pan || "",
      })

      const sourceVehicles = Array.isArray(data.lastCustomerFor)
        ? data.lastCustomerFor
        : Array.isArray(data.vehicles)
          ? data.vehicles
          : []

      const loadedVehicles: VehicleRow[] = sourceVehicles.map((row: any) => ({
            id: row.id,
            registrationNumber: row.registrationNumber || "",
            make: row.make || "",
            model: row.model || "",
            createdAt: row.createdAt,
            isNew: false,
          }))

      setVehicles(loadedVehicles)
      setEditableVehicleRowIds(new Set())
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to load customer")
    }
  }

  const handleNewCustomer = () => {
    setSelectedCustomerId("")
    setCustomerForm(defaultCustomerForm())
    setVehicles([])
    setEditableVehicleRowIds(new Set())
    setMobileError("")
  }

  const handleOpenCustomerModalForAdd = () => {
    handleNewCustomer()
    if (shopStateCode) {
      setCustomerForm((prev) => ({ ...prev, state: shopStateCode }))
    }
    setIsCustomerModalOpen(true)
  }

  const handleOpenCustomerModalForEdit = async (customerId: string) => {
    setIsLoadingModalData(true)
    setIsCustomerModalOpen(true)
    try {
      await loadCustomer(customerId)
    } finally {
      setIsLoadingModalData(false)
    }
  }

  const handleOpenVehicleModal = async (customerId: string) => {
    setIsLoadingModalData(true)
    setIsVehicleModalOpen(true)
    try {
      await loadCustomer(customerId)
    } finally {
      setIsLoadingModalData(false)
    }
  }

  const validateMobileNumber = (mobileNo: string): string => {
    return getMobileValidationMessage(mobileNo) || ""
  }

  const checkMobileUniqueness = async (mobileNo: string): Promise<string> => {
    try {
      const response = await fetch(`/api/customers/check-mobile?mobileNo=${encodeURIComponent(mobileNo.trim())}`)
      const data = await response.json()

      if (!response.ok) {
        return ""
      }

      // If a customer exists with this mobile number and it's not the current customer
      if (data.exists && data.customerId !== selectedCustomerId) {
        return `Mobile number already exists (Customer: ${data.customerName})`
      }

      return ""
    } catch (error) {
      return ""
    }
  }

  const handleSaveCustomer = async () => {
    if (!customerForm.name.trim() || !customerForm.mobileNo.trim()) {
      errorAction("Customer Name and Mobile Number are required")
      setMobileError("")
      return
    }

    // Validate mobile number format
    const mobileValidationError = validateMobileNumber(customerForm.mobileNo)
    if (mobileValidationError) {
      setMobileError(mobileValidationError)
      errorAction(mobileValidationError)
      return
    }

    // Check for uniqueness
    const uniquenessError = await checkMobileUniqueness(customerForm.mobileNo)
    if (uniquenessError) {
      setMobileError(uniquenessError)
      errorAction(uniquenessError)
      return
    }

    setMobileError("")
    setIsSavingCustomer(true)
    try {
      const payload = {
        name: customerForm.name.trim(),
        mobileNo: normalizeMobileNumber(customerForm.mobileNo),
        address: composeAddress(
          {
            line1: customerForm.addressLine1,
            line2: customerForm.addressLine2,
            city: customerForm.city,
            district: customerForm.district,
            postalCode: customerForm.postalCode,
          },
          { includeState: false }
        ),
        state: customerForm.state.trim(),
        gstin: customerForm.gstin.trim(),
        pan: customerForm.pan.trim(),
      }

      const url = selectedCustomerId ? `/api/customers/${selectedCustomerId}` : "/api/customers"
      const method = selectedCustomerId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save customer")
      }

      successAction(selectedCustomerId ? "Customer updated" : "Customer created")
      setIsCustomerModalOpen(false)
      handleNewCustomer()
      await loadCustomers(globalSearch)
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to save customer")
    } finally {
      setIsSavingCustomer(false)
    }
  }

  const handleDeleteCustomer = async () => {
    if (!customerToDelete?.id) return

    setIsSavingCustomer(true)
    try {
      const response = await fetch(`/api/customers/${customerToDelete.id}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete customer")
      }

      successAction("Customer deleted")
      setDeleteCustomerDialog(false)
      setCustomerToDelete(null)
      handleNewCustomer()
      await loadCustomers(globalSearch)
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to delete customer")
    } finally {
      setIsSavingCustomer(false)
    }
  }

  const updateVehicleField = (id: string, key: keyof VehicleRow, value: string) => {
    updateVehicleRow(id, { [key]: value } as Partial<VehicleRow>)
  }

  const handleVehicleRowFocus = (id: string) => {
    // Don't auto-insert a new vehicle row on focus. New rows are added
    // when the user modifies the last row (see `updateVehicleField`).
    return
  }

  const handleDeleteVehicle = async (row: VehicleRow) => {
    if (row.isNew) {
      setVehicles((prev) => {
        const filtered = prev.filter((item) => item.id !== row.id)
        return filtered
      })
      setEditableVehicleRowIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
      return
    }

    try {
      const response = await fetch(`/api/vehicles/${row.id}`, {
        method: "DELETE",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete vehicle")
      }

      successAction("Vehicle deleted")
      setVehicles((prev) => {
        const filtered = prev.filter((item) => item.id !== row.id)
        return filtered
      })
      setEditableVehicleRowIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to delete vehicle")
    }
  }

  const toggleVehicleRowEdit = (rowId: string) => {
    setEditableVehicleRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
  }

  const handleSaveVehicleRow = async (row: VehicleRow) => {
    if (!selectedCustomerId) {
      errorAction("No CustomerID selected")
      return
    }

    if (!row.registrationNumber.trim()) {
      errorAction("RegistrationNumber is required")
      return
    }

    setIsSavingVehicles(true)
    try {
      const payload = {
        registrationNumber: row.registrationNumber.trim(),
        make: row.make.trim() || "Unknown",
        model: row.model.trim() || "Unknown",
        lastCustomerId: selectedCustomerId,
      }

      if (row.isNew) {
        const response = await fetch("/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to create vehicle")
        }
      } else {
        const response = await fetch(`/api/vehicles/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to update vehicle")
        }
      }

      successAction("Vehicle saved")
      await loadCustomer(selectedCustomerId)
      await loadCustomers(globalSearch)
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to save vehicle")
    } finally {
      setIsSavingVehicles(false)
    }
  }

  const handleSaveVehicles = async () => {
    if (!selectedCustomerId) {
      errorAction("No CustomerID selected")
      return
    }

    const rowsToSave = vehicles.filter(isVehicleRowTouched)

    const hasEmptyRegistration = rowsToSave.some(
      (row) => !row.registrationNumber.trim()
    )

    if (hasEmptyRegistration) {
      errorAction("RegistrationNumber is required for every vehicle")
      return
    }

    setIsSavingVehicles(true)
    try {
      for (const row of rowsToSave) {
        const payload = {
          registrationNumber: row.registrationNumber.trim(),
          make: row.make.trim() || "Unknown",
          model: row.model.trim() || "Unknown",
          lastCustomerId: selectedCustomerId,
        }

        if (row.isNew) {
          const response = await fetch("/api/vehicles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

          const data = await response.json()
          if (!response.ok) {
            throw new Error(data.error || "Failed to create vehicle")
          }
        } else {
          const response = await fetch(`/api/vehicles/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

          const data = await response.json()
          if (!response.ok) {
            throw new Error(data.error || "Failed to update vehicle")
          }
        }
      }

      successAction("Vehicles saved")
      await loadCustomer(selectedCustomerId)
      await loadCustomers(globalSearch)
    } catch (error) {
      errorAction(error instanceof Error ? error.message : "Failed to save vehicles")
    } finally {
      setIsSavingVehicles(false)
    }
  }

  return (
    <div className="global-subform-table-content flex min-h-0 flex-col">
      <div className="form-table-wrapper form-table-wrapper--independent-tl customer-table-wrapper shrink-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-100/80">
              <tr>
                <th className="text-center font-medium px-3 py-2">Customer Name</th>
                <th className="text-center font-medium px-3 py-2">Mobile</th>
                <th className="text-left font-medium px-3 py-2">Address</th>
                <th className="text-center font-medium px-3 py-2">State</th>
                <th className="text-center font-medium px-3 py-2 w-[180px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingCustomers ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-t">
                    <td className="px-3 py-2 text-center font-medium">{customer.name}</td>
                    <td className="px-3 py-2 text-center">{customer.mobileNo}</td>
                    <td className="px-3 py-2 text-left">{customer.address || "-"}</td>
                    <td className="px-3 py-2 text-center">{customer.state || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleOpenCustomerModalForEdit(customer.id)}
                          disabled={isSavingCustomer || isSavingVehicles}
                          aria-label="Edit Customer"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleOpenVehicleModal(customer.id)}
                          disabled={isSavingCustomer || isSavingVehicles}
                          aria-label="View Vehicles"
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-800"
                        >
                          <CarFront className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCustomerToDelete(customer)
                            setDeleteCustomerDialog(true)
                          }}
                          disabled={isSavingCustomer || isSavingVehicles}
                          aria-label="Delete Customer"
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

      <div className="shrink-0">
        <Button
          type="button"
          onClick={handleOpenCustomerModalForAdd}
          disabled={isSavingCustomer || isSavingVehicles}
          className="global-bottom-btn-add"
          variant="ghost"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Dialog
        open={isCustomerModalOpen}
        onOpenChange={(open) => {
          setIsCustomerModalOpen(open)
          if (!open) {
            handleNewCustomer()
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              {selectedCustomerId ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomerId ? "Update customer details." : "Enter customer details to create a new record."}
            </DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
            {isLoadingModalData ? (
              <div className="text-sm text-muted-foreground">Loading customer details...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-1 items-start">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Input
                    id="customer-name"
                    value={customerForm.name}
                    onChange={(event) =>
                      setCustomerForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-mobile">Mobile No</Label>
                  <Input
                    id="customer-mobile"
                    value={customerForm.mobileNo}
                    onChange={(event) => {
                      setCustomerForm((prev) => ({ ...prev, mobileNo: normalizeMobileNumber(event.target.value) }))
                      setMobileError("")
                    }}
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    autoComplete="off"
                    className={mobileError ? "border-red-500 focus:border-red-500" : ""}
                  />
                  {mobileError ? <p className="text-xs text-red-600">{mobileError}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-state">State Code</Label>
                  <Input
                    id="customer-state"
                    value={customerForm.state}
                    onChange={(event) =>
                      setCustomerForm((prev) => ({ ...prev, state: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="customer-address-line-1">Address Line 1 (Apartment, Suite, Unit, Building, Floor)</Label>
                  <Input
                    id="customer-address-line-1"
                    value={customerForm.addressLine1}
                    onChange={(event) =>
                      setCustomerForm((prev) => ({ ...prev, addressLine1: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="customer-address-line-2">Address Line 2 (Street Address)</Label>
                  <Input
                    id="customer-address-line-2"
                    value={customerForm.addressLine2}
                    onChange={(event) =>
                      setCustomerForm((prev) => ({ ...prev, addressLine2: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-city">City</Label>
                  <Input
                    id="customer-city"
                    value={customerForm.city}
                    onChange={(event) =>
                      setCustomerForm((prev) => ({ ...prev, city: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-district">District</Label>
                  <Input
                    id="customer-district"
                    value={customerForm.district}
                    onChange={(event) =>
                      setCustomerForm((prev) => ({ ...prev, district: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-postal-code">Postal Code</Label>
                  <Input
                    id="customer-postal-code"
                    value={customerForm.postalCode}
                    onChange={(event) =>
                      setCustomerForm((prev) => ({ ...prev, postalCode: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-gstin">GSTIN</Label>
                  <Input
                    id="customer-gstin"
                    value={customerForm.gstin}
                    onChange={(event) =>
                      setCustomerForm((prev) => ({ ...prev, gstin: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-pan">PAN</Label>
                  <Input
                    id="customer-pan"
                    value={customerForm.pan}
                    onChange={(event) =>
                      setCustomerForm((prev) => ({ ...prev, pan: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-5 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCustomerModalOpen(false)}
                disabled={isSavingCustomer}
                className="px-4 py-2 min-h-[40px] bg-white hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveCustomer}
                disabled={isSavingCustomer || isLoadingModalData}
                className="px-4 py-2 min-h-[40px] flex items-center gap-2"
                style={{ backgroundColor: '#2563eb', color: 'white' }}
              >
                {isSavingCustomer ? "Saving..." : selectedCustomerId ? "Update" : "Save"}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isVehicleModalOpen}
        onOpenChange={(open) => {
          setIsVehicleModalOpen(open)
          if (!open) {
            setVehicles([])
            setSelectedCustomerId("")
            setEditableVehicleRowIds(new Set())
          }
        }}
      >
        <DialogContent className="max-w-4xl lg:max-w-6xl max-h-[98vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Vehicle Master</DialogTitle>
            <DialogDescription>
              Edit and save vehicles for the selected customer directly in this form.
            </DialogDescription>
          </DialogHeader>

          <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3 overflow-y-auto max-h-[75vh]">
            {isLoadingModalData ? (
              <div className="text-sm text-muted-foreground">Loading vehicles...</div>
            ) : (
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-100/80">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Registration Number</th>
                      <th className="text-left font-medium px-3 py-2">Vehicle Make</th>
                      <th className="text-left font-medium px-3 py-2">Vehicle Model</th>
                      <th className="text-left font-medium px-3 py-2 w-[150px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          No vehicles linked to this customer.
                        </td>
                      </tr>
                    ) : (
                      vehicles.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="p-2">
                            <Input
                              value={row.registrationNumber}
                              onChange={(event) =>
                                updateVehicleField(row.id, "registrationNumber", event.target.value)
                              }
                              onFocus={() => handleVehicleRowFocus(row.id)}
                              disabled={!editableVehicleRowIds.has(row.id)}
                              className={!editableVehicleRowIds.has(row.id) ? "bg-slate-100" : ""}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={row.make}
                              onChange={(event) => updateVehicleField(row.id, "make", event.target.value)}
                              onFocus={() => handleVehicleRowFocus(row.id)}
                              disabled={!editableVehicleRowIds.has(row.id)}
                              className={!editableVehicleRowIds.has(row.id) ? "bg-slate-100" : ""}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={row.model}
                              onChange={(event) => updateVehicleField(row.id, "model", event.target.value)}
                              onFocus={() => handleVehicleRowFocus(row.id)}
                              disabled={!editableVehicleRowIds.has(row.id)}
                              className={!editableVehicleRowIds.has(row.id) ? "bg-slate-100" : ""}
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex justify-start gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (editableVehicleRowIds.has(row.id)) {
                                    void handleSaveVehicleRow(row)
                                  } else {
                                    toggleVehicleRowEdit(row.id)
                                  }
                                }}
                                aria-label={editableVehicleRowIds.has(row.id) ? "Save Vehicle" : "Enable Edit"}
                                disabled={isSavingVehicles}
                                className={`h-8 w-8 p-0 ${editableVehicleRowIds.has(row.id) ? "text-emerald-600 hover:text-emerald-800" : "text-blue-600 hover:text-blue-800"}`}
                              >
                                {editableVehicleRowIds.has(row.id) ? <Save className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => void handleDeleteVehicle(row)}
                                aria-label="Delete Vehicle"
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
            )}

            <DialogFooter className="sticky-form-actions flex flex-col items-stretch gap-2">
              <Button
                type="button"
                onClick={() => setVehicles((prev) => [...prev, emptyVehicle()])}
                variant="ghost"
                className="w-full justify-start border border-dashed border-emerald-500 text-emerald-500 hover:bg-green-50 bg-transparent"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle Row
              </Button>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsVehicleModalOpen(false)}
                  disabled={isSavingVehicles}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveVehicles}
                  disabled={isSavingVehicles || isLoadingModalData || vehicles.filter(isVehicleRowTouched).length === 0}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isSavingVehicles ? "Saving..." : "Save Vehicles"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteCustomerDialog} onOpenChange={setDeleteCustomerDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {customerToDelete?.name || "this customer"} and all linked vehicles. Proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

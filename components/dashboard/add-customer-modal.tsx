"use client"

import { useEffect, useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { notify } from '@/components/ui/notify'
import { toProperCase } from "@/lib/utils"
import { getMobileValidationMessage, normalizeMobileNumber } from "@/lib/mobile-validation"
import { composeAddress } from "@/lib/address-utils"
import { ChevronDown } from "lucide-react"

interface State {
  id: string
  stateName: string
  stateCode: string
}

interface AddCustomerModalProps {
  open: boolean
  mobileNumber: string
  onOpenChange: (open: boolean) => void
  onCustomerAdded: (customer: any) => void
}

export function AddCustomerModal({
  open,
  mobileNumber,
  onOpenChange,
  onCustomerAdded,
}: AddCustomerModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [states, setStates] = useState<State[]>([])
  const [showStateDropdown, setShowStateDropdown] = useState(false)
  const [stateFilter, setStateFilter] = useState("")
  const [shopStateKey, setShopStateKey] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    mobileNo: mobileNumber,
    name: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
  })

  // Fetch states and shop settings on component mount
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await fetch("/api/settings/states")
        const data = await response.json()
        setStates(data)
      } catch (error) {
        console.error("Error fetching states:", error)
      }
    }
    const fetchShopSettings = async () => {
      try {
        const response = await fetch("/api/settings/shop")
        const data = await response.json()
        setShopStateKey(String(data?.stateId ?? ""))
      } catch (error) {
        console.error("Error fetching shop settings:", error)
      }
    }
    fetchStates()
    fetchShopSettings()
  }, [])

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStateDropdown(false)
      }
    }
    if (showStateDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showStateDropdown])

  // Update mobile number when prop changes and apply shop-state default when modal opens
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      mobileNo: mobileNumber,
    }))
    if (open) {
      const defaultState = shopStateKey
        ? states.find((s) => s.id === shopStateKey || s.stateCode === shopStateKey)
        : null
      setFormData((prev) => ({ ...prev, state: defaultState?.id || "" }))
      setStateFilter(defaultState?.stateName || "")
      setShowStateDropdown(false)
    }
  }, [mobileNumber, open, shopStateKey, states])

  const getStateName = (stateId: string) => {
    const state = states.find(s => s.id === stateId || s.stateCode === stateId)
    return state ? state.stateName : ""
  }

  const getStateCode = (stateId: string) => {
    const state = states.find(s => s.id === stateId || s.stateCode === stateId)
    return state ? state.stateCode : ""
  }

  const handleStateSelect = (state: State) => {
    setFormData((prev) => ({
      ...prev,
      state: state.id,
    }))
    setShowStateDropdown(false)
    setStateFilter("")
  }

  const filteredStates = states.filter(
    state =>
      state.stateName.toLowerCase().includes(stateFilter.toLowerCase()) ||
      state.stateCode.toLowerCase().includes(stateFilter.toLowerCase())
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async () => {
    try {
      const mobileError = getMobileValidationMessage(formData.mobileNo)
      if (mobileError) {
        notify.error(mobileError)
        return
      }

      if (!formData.name.trim()) {
        notify.error("Customer name is required")
        return
      }

      setIsLoading(true)

      // Convert data to proper format
      const submissionData = {
        mobileNo: normalizeMobileNumber(formData.mobileNo),
        name: toProperCase(formData.name.trim()),
        email: formData.email.trim(),
        address: composeAddress(
          {
            line1: formData.addressLine1,
            line2: formData.addressLine2,
            city: formData.city,
            district: formData.district,
            postalCode: formData.pincode,
          },
          { includeState: false }
        ),
        city: formData.city ? toProperCase(formData.city.trim()) : "",
        stateId: formData.state,
        pincode: formData.pincode.trim(),
      }

      console.log("Submitting customer form:", submissionData)

      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      })

      console.log("API response status:", response.status)

      const data = await response.json()

      console.log("API response data:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to create customer")
      }

      const customer = data
      console.log("Customer created successfully:", customer)
      notify.success("Customer added successfully!")
      onCustomerAdded(customer)
      onOpenChange(false)
      setFormData({
        mobileNo: "",
        name: "",
        email: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        district: "",
        state: "",
        pincode: "",
      })
    } catch (error) {
      console.error("Error creating customer:", error)
      notify.error(error instanceof Error ? error.message : "Failed to create customer")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Add New Customer</DialogTitle>
          <DialogDescription>
            Customer not found. Please create a new customer record.
          </DialogDescription>
        </DialogHeader>

        <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mobile" className="font-semibold">
                Mobile Number
              </Label>
              <Input
                id="mobile"
                name="mobileNo"
                value={formData.mobileNo}
                disabled
                className="bg-slate-100 cursor-not-allowed"
                maxLength={10}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold">
                Customer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="font-semibold">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="addressLine1" className="font-semibold">
                Address Line 1 (Apartment, Suite, Unit, Building, Floor)
              </Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressLine2" className="font-semibold">
                Address Line 2 (Street Address)
              </Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-2">
              <Label htmlFor="city" className="font-semibold">
                City
              </Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district" className="font-semibold">
                District
              </Label>
              <Input
                id="district"
                name="district"
                value={formData.district}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state" className="font-semibold">
                State
              </Label>
              <div className="relative" ref={dropdownRef}>
                <Input
                  id="state"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  onFocus={() => setShowStateDropdown(true)}
                  placeholder="Search state..."
                  disabled={isLoading}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowStateDropdown((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  <ChevronDown size={16} />
                </button>
                {showStateDropdown && (
                  <div className="dropdown-container">
                    <div className="dropdown-scroll">
                      {filteredStates.length > 0 ? (
                        filteredStates.map((state) => (
                          <button
                            key={state.id}
                            type="button"
                            onClick={() => handleStateSelect(state)}
                            className={`dropdown-item w-full text-left ${
                              formData.state === state.id ? "selected" : ""
                            }`}
                          >
                            <span className="font-medium">{state.stateName}</span>
                            <span className="text-xs text-slate-500 ml-2">({state.stateCode})</span>
                          </button>
                        ))
                      ) : (
                        <div className="dropdown-empty-state">No states found</div>
                      )}
                    </div>
                  </div>
                )}
                {formData.state && (
                  <div className="text-xs text-slate-500 mt-1">
                    Selected: {getStateName(formData.state)} ({getStateCode(formData.state)})
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode" className="font-semibold">
                Pincode
              </Label>
              <Input
                id="pincode"
                name="pincode"
                value={formData.pincode}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-5 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

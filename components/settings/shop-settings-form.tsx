"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { notify } from "@/components/ui/notify"
import { startAction, successAction, errorAction } from "@/lib/action-feedback"
import { parseJsonResponse } from "@/lib/http"
import { LocateFixed, Save } from "lucide-react"

interface State {
  id: string
  stateName: string
  stateCode: string
}

interface ShopSettingsData {
  id: string
  shopName: string
  address: string
  city: string
  state: string
  pincode: string
  phone1: string
  phone2: string
  upiId: string
  email: string
  gstin: string
  pan: string
  stateId: string
  website: string
  logo: string
  garageLatitude: string
  garageLongitude: string
  attendanceRadiusMeters: string
}

const initialFormData: ShopSettingsData = {
  id: "",
  shopName: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  phone1: "",
  phone2: "",
  upiId: "",
  email: "",
  gstin: "",
  pan: "",
  stateId: "",
  website: "",
  logo: "",
  garageLatitude: "",
  garageLongitude: "",
  attendanceRadiusMeters: "20",
}

export default function ShopSettingsForm() {
  const [formData, setFormData] = useState<ShopSettingsData>(initialFormData)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)
  const [availableStates, setAvailableStates] = useState<State[]>([])
  const [selectedStateId, setSelectedStateId] = useState<string>("")
  const [stateFilter, setStateFilter] = useState("")
  const [showStateDropdown, setShowStateDropdown] = useState(false)
  const [stateSelectedIndex, setStateSelectedIndex] = useState(-1)

  const stateListRef = useRef<HTMLDivElement | null>(null)
  const stateOptionRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    loadStates()
    loadSettings()
  }, [])

  useEffect(() => {
    // When form data loads, sync the selected state
    if (formData.stateId && availableStates.length > 0) {
      const foundState = availableStates.find(s => s.stateCode === formData.stateId)
      if (foundState) {
        setSelectedStateId(foundState.id)
        setStateFilter(foundState.stateName)
      }
    }
  }, [formData.stateId, availableStates])

  useEffect(() => {
    // Scroll selected item into view
    if (stateSelectedIndex >= 0 && stateOptionRefs.current[stateSelectedIndex]) {
      stateOptionRefs.current[stateSelectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [stateSelectedIndex])

  // Close state dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showStateDropdown && stateListRef.current && !stateListRef.current.contains(event.target as Node)) {
        const inputElement = document.getElementById('state')
        if (inputElement && !inputElement.contains(event.target as Node)) {
          setShowStateDropdown(false)
          setStateSelectedIndex(-1)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showStateDropdown])

  const loadStates = async () => {
    try {
      const response = await fetch("/api/settings/states")
      const data = await parseJsonResponse<any[]>(response, "Failed to load states")
      if (Array.isArray(data)) {
        const formattedStates = data.map((s) => ({
          id: String(s.stateId || s.id || ""),
          stateName: String(s.stateName || ""),
          stateCode: String(s.stateCode || ""),
        }))
        setAvailableStates(formattedStates)
      }
    } catch (error) {
      console.error("Error loading states:", error)
    }
  }

  const loadSettings = async () => {
    try {
      setIsFetching(true)
      const response = await fetch("/api/settings/shop")
      const data = await parseJsonResponse<Partial<ShopSettingsData>>(response, "Failed to load settings")

      // Ensure no null values - convert to empty strings
      const sanitizedData: ShopSettingsData = {
        id: String(data.id ?? ""),
        shopName: String(data.shopName ?? ""),
        address: String(data.address ?? ""),
        city: String(data.city ?? ""),
        state: String(data.state ?? ""),
        pincode: String(data.pincode ?? ""),
        phone1: String(data.phone1 ?? ""),
        phone2: String(data.phone2 ?? ""),
        upiId: String(data.upiId ?? ""),
        email: String(data.email ?? ""),
        gstin: String(data.gstin ?? ""),
        pan: String(data.pan ?? ""),
        stateId: String(data.stateId ?? ""),
        website: String(data.website ?? ""),
        logo: String(data.logo ?? ""),
        garageLatitude: String(data.garageLatitude ?? ""),
        garageLongitude: String(data.garageLongitude ?? ""),
        attendanceRadiusMeters: String(data.attendanceRadiusMeters ?? "20"),
      }
      setFormData(sanitizedData)
    } catch (error) {
      console.error("Error loading settings:", error)
      errorAction(error instanceof Error ? error.message : "Failed to load settings")
    } finally {
      setIsFetching(false)
    }
  }

  const handleSave = async () => {
    if (!formData.shopName.trim()) {
      errorAction("Shop name is required")
      return
    }

    try {
      setIsLoading(true)
      startAction("Saving shop settings...")

      const response = await fetch("/api/settings/shop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await parseJsonResponse<Partial<ShopSettingsData>>(response, "Failed to save settings")

      // Sanitize response to ensure no null values
      const sanitizedData: ShopSettingsData = {
        id: String(data.id ?? ""),
        shopName: String(data.shopName ?? ""),
        address: String(data.address ?? ""),
        city: String(data.city ?? ""),
        state: String(data.state ?? ""),
        pincode: String(data.pincode ?? ""),
        phone1: String(data.phone1 ?? ""),
        phone2: String(data.phone2 ?? ""),
        upiId: String(data.upiId ?? ""),
        email: String(data.email ?? ""),
        gstin: String(data.gstin ?? ""),
        pan: String(data.pan ?? ""),
        stateId: String(data.stateId ?? ""),
        website: String(data.website ?? ""),
        logo: String(data.logo ?? ""),
        garageLatitude: String(data.garageLatitude ?? ""),
        garageLongitude: String(data.garageLongitude ?? ""),
        attendanceRadiusMeters: String(data.attendanceRadiusMeters ?? "20"),
      }
      setFormData(sanitizedData)
      successAction("Shop settings saved successfully")
    } catch (error) {
      console.error("Error saving settings:", error)
      errorAction(error instanceof Error ? error.message : "Failed to save settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: keyof ShopSettingsData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: String(value || "") }))
  }

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      errorAction("Geolocation is not supported on this device")
      return
    }

    try {
      setIsFetchingLocation(true)
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })

      setFormData((prev) => ({
        ...prev,
        garageLatitude: position.coords.latitude.toFixed(7),
        garageLongitude: position.coords.longitude.toFixed(7),
      }))
      successAction("Current location captured. Save settings to apply it.")
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to capture current location")
    } finally {
      setIsFetchingLocation(false)
    }
  }

  const handleStateChange = (stateId: string) => {
    setSelectedStateId(stateId)
    const selectedState = availableStates.find(s => s.id === stateId)
    if (selectedState) {
      setFormData(prev => ({
        ...prev,
        state: String(selectedState.stateName || ""),
        stateId: String(selectedState.stateCode || "") // Store state code
      }))
      setStateFilter(selectedState.stateName)
      setShowStateDropdown(false)
      setStateSelectedIndex(-1)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading shop settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border border-slate-200 rounded-lg bg-white p-6">
        <div>
          <h3 className="text-lg font-semibold">Shop Settings</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Configure your shop details that will appear on invoices and documents
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Set the garage latitude and longitude for mobile attendance geo-fencing.
          </p>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Shop Name */}
        <div>
          <Label htmlFor="shopName" className="text-sm font-medium">
            Shop Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="shopName"
            name="shopName"
            value={formData.shopName}
            onChange={(e) => handleChange("shopName", e.target.value)}
            disabled={isLoading}
            placeholder="Enter shop name"
            className="mt-1.5"
          />
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <Label htmlFor="address" className="text-sm font-medium">
            Address
          </Label>
          <Input
            id="address"
            name="address"
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            disabled={isLoading}
            placeholder="Enter shop address"
            className="mt-1.5"
          />
        </div>

        {/* City */}
        <div>
          <Label htmlFor="city" className="text-sm font-medium">
            City
          </Label>
          <Input
            id="city"
            name="city"
            value={formData.city}
            onChange={(e) => handleChange("city", e.target.value)}
            disabled={isLoading}
            placeholder="Enter city"
            className="mt-1.5"
          />
        </div>

        {/* Pincode */}
        <div>
          <Label htmlFor="pincode" className="text-sm font-medium">
            Pincode
          </Label>
          <Input
            id="pincode"
            name="pincode"
            value={formData.pincode}
            onChange={(e) => handleChange("pincode", e.target.value)}
            disabled={isLoading}
            placeholder="Enter pincode"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="garageLatitude" className="text-sm font-medium">
            Garage Latitude
          </Label>
          <Input
            id="garageLatitude"
            name="garageLatitude"
            value={formData.garageLatitude}
            onChange={(e) => handleChange("garageLatitude", e.target.value)}
            disabled={isLoading}
            placeholder="12.9715987"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="garageLongitude" className="text-sm font-medium">
            Garage Longitude
          </Label>
          <Input
            id="garageLongitude"
            name="garageLongitude"
            value={formData.garageLongitude}
            onChange={(e) => handleChange("garageLongitude", e.target.value)}
            disabled={isLoading}
            placeholder="77.594566"
            className="mt-1.5"
          />
        </div>

        <div className="md:col-span-3 flex justify-start">
          <Button
            type="button"
            variant="outline"
            onClick={useCurrentLocation}
            disabled={isLoading || isFetchingLocation}
            className="mt-1.5 gap-2"
          >
            <LocateFixed className="h-4 w-4" />
            {isFetchingLocation ? "Capturing Location..." : "Use Current Location"}
          </Button>
        </div>

        <div>
          <Label htmlFor="attendanceRadiusMeters" className="text-sm font-medium">
            Attendance Radius (Meters)
          </Label>
          <Input
            id="attendanceRadiusMeters"
            name="attendanceRadiusMeters"
            type="number"
            min="1"
            value={formData.attendanceRadiusMeters}
            onChange={(e) => handleChange("attendanceRadiusMeters", e.target.value)}
            disabled={isLoading}
            placeholder="20"
            className="mt-1.5"
          />
        </div>

        {/* State Name */}
        <div className="space-y-2 relative">
          <Label htmlFor="state" className="text-sm font-medium">
            State Name
          </Label>
          <div className="relative w-full">
            <Input
              id="state"
              placeholder="Search and select state..."
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value)
                setShowStateDropdown(true)
                setStateSelectedIndex(-1)
              }}
              onKeyDown={(e) => {
                if (!showStateDropdown) return

                const filteredStates = availableStates.filter(state =>
                  state.id && (
                    stateFilter === "" ||
                    state.stateName.toLowerCase().includes(stateFilter.toLowerCase()) ||
                    state.stateCode.toLowerCase().includes(stateFilter.toLowerCase())
                  )
                )

                switch (e.key) {
                  case "ArrowDown":
                    e.preventDefault()
                    setStateSelectedIndex(prev =>
                      prev < filteredStates.length - 1 ? prev + 1 : prev
                    )
                    break
                  case "ArrowUp":
                    e.preventDefault()
                    setStateSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
                    break
                  case "Enter":
                    e.preventDefault()
                    if (stateSelectedIndex >= 0 && filteredStates[stateSelectedIndex]) {
                      const state = filteredStates[stateSelectedIndex]
                      handleStateChange(state.id)
                    }
                    break
                  case "Escape":
                    e.preventDefault()
                    setShowStateDropdown(false)
                    setStateSelectedIndex(-1)
                    break
                }
              }}
              onClick={() => {
                setShowStateDropdown((prev) => {
                  if (prev) {
                    setStateSelectedIndex(-1)
                  }
                  return !prev
                })
              }}
              disabled={isLoading}
              autoComplete="off"
              className="mt-1.5"
            />
            {showStateDropdown && (
              <div
                ref={stateListRef}
                className="absolute top-full left-0 right-0 mt-1 dropdown-scroll z-[100]"
                onWheel={(e) => {
                  const el = stateListRef.current
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
                        state.id && (
                          stateFilter === "" ||
                          state.stateName.toLowerCase().includes(stateFilter.toLowerCase()) ||
                          state.stateCode.toLowerCase().includes(stateFilter.toLowerCase())
                        )
                      )
                      .map((state, index) => (
                        <button
                          key={state.id}
                          ref={(el) => {
                            stateOptionRefs.current[index] = el
                          }}
                          onClick={() => handleStateChange(state.id)}
                          className={`dropdown-item compact ${
                            index === stateSelectedIndex ? "selected" : ""
                          }`}
                        >
                          {state.stateName}
                        </button>
                      ))}
                    {availableStates.filter(state =>
                      stateFilter === "" || (
                        state.stateName.toLowerCase().includes(stateFilter.toLowerCase()) ||
                        state.stateCode.toLowerCase().includes(stateFilter.toLowerCase())
                      )
                    ).length === 0 && (
                      <div className="dropdown-empty-state">No states found</div>
                    )}
                  </>
                ) : (
                  <div className="dropdown-empty-state">Loading states...</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* State Code */}
        <div>
          <Label htmlFor="stateCode" className="text-sm font-medium">
            State Code
          </Label>
          <Input
            id="stateCode"
            value={formData.stateId}
            disabled={true}
            placeholder="Auto-populated"
            className="mt-1.5 bg-slate-50"
          />
        </div>
        <div>
          <Label htmlFor="phone1" className="text-sm font-medium">
            Phone 1
          </Label>
          <Input
            id="phone1"
            name="phone1"
            value={formData.phone1}
            onChange={(e) => handleChange("phone1", e.target.value)}
            disabled={isLoading}
            placeholder="Enter primary phone"
            className="mt-1.5"
          />
        </div>

        {/* Phone 2 */}
        <div>
          <Label htmlFor="phone2" className="text-sm font-medium">
            Phone 2
          </Label>
          <Input
            id="phone2"
            name="phone2"
            value={formData.phone2}
            onChange={(e) => handleChange("phone2", e.target.value)}
            disabled={isLoading}
            placeholder="Enter secondary phone"
            className="mt-1.5"
          />
        </div>

        {/* Email */}
        <div className="md:col-span-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            disabled={isLoading}
            placeholder="Enter email address"
            className="mt-1.5"
          />
        </div>

        {/* UPI ID */}
        <div>
          <Label htmlFor="upiId" className="text-sm font-medium">
            UPI ID
          </Label>
          <Input
            id="upiId"
            name="upiId"
            value={formData.upiId}
            onChange={(e) => handleChange("upiId", e.target.value)}
            disabled={isLoading}
            placeholder="Enter UPI ID (e.g., garage@upi)"
            autoComplete="off"
            className="mt-1.5"
          />
        </div>

        {/* GSTIN */}
        <div>
          <Label htmlFor="gstin" className="text-sm font-medium">
            GSTIN
          </Label>
          <Input
            id="gstin"
            name="gstin"
            value={formData.gstin}
            onChange={(e) => handleChange("gstin", e.target.value)}
            disabled={isLoading}
            placeholder="Enter GSTIN"
            className="mt-1.5"
          />
        </div>

        {/* PAN */}
        <div>
          <Label htmlFor="pan" className="text-sm font-medium">
            PAN
          </Label>
          <Input
            id="pan"
            name="pan"
            value={formData.pan}
            onChange={(e) => handleChange("pan", e.target.value)}
            disabled={isLoading}
            placeholder="Enter PAN"
            className="mt-1.5"
          />
        </div>

        {/* Website */}
        <div>
          <Label htmlFor="website" className="text-sm font-medium">
            Website
          </Label>
          <Input
            id="website"
            name="website"
            value={formData.website}
            onChange={(e) => handleChange("website", e.target.value)}
            disabled={isLoading}
            placeholder="Enter website URL"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="sticky-form-actions flex justify-end gap-5 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={loadSettings}
          disabled={isLoading || isFetching}
          className="bg-white hover:bg-gray-100"
        >
          Reset
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isFetching}
          className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>
      </div>
    </div>
  )
}

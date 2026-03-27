"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { notify } from "@/components/ui/notify"
import { startAction, successAction, errorAction } from "@/lib/action-feedback"
import { parseJsonResponse } from "@/lib/http"
import { composeAddress, parseAddress } from "@/lib/address-utils"
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

interface ShopSettingsFormProps {
  panelCornerClass?: string
}

export default function ShopSettingsForm({ panelCornerClass = "" }: ShopSettingsFormProps) {
  const [formData, setFormData] = useState<ShopSettingsData>(initialFormData)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)
  const [availableStates, setAvailableStates] = useState<State[]>([])
  const [selectedStateId, setSelectedStateId] = useState<string>("")
  const [stateFilter, setStateFilter] = useState("")
  const [showStateDropdown, setShowStateDropdown] = useState(false)
  const [stateSelectedIndex, setStateSelectedIndex] = useState(-1)
  const [addressFields, setAddressFields] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    district: "",
    postalCode: "",
  })

  const stateListRef = useRef<HTMLDivElement | null>(null)
  const stateOptionRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Stable refs so custom event listeners never go stale
  const handleSaveRef = useRef<() => Promise<void>>(async () => {})
  const loadSettingsRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    loadStates()
    loadSettings()
  }, [])

  useEffect(() => {
    const onSave = () => handleSaveRef.current()
    const onReset = () => loadSettingsRef.current()
    window.addEventListener("shopSettings:save", onSave)
    window.addEventListener("shopSettings:reset", onReset)
    return () => {
      window.removeEventListener("shopSettings:save", onSave)
      window.removeEventListener("shopSettings:reset", onReset)
    }
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
      const response = await fetch("/api/settings/states", { cache: 'force-cache' })
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
      const response = await fetch("/api/settings/shop", { cache: 'force-cache' })
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
      const parsedAddress = parseAddress(sanitizedData.address)
      setAddressFields({
        addressLine1: parsedAddress.line1 ?? "",
        addressLine2: parsedAddress.line2 ?? "",
        city: parsedAddress.city || sanitizedData.city,
        district: parsedAddress.district ?? "",
        postalCode: parsedAddress.postalCode || sanitizedData.pincode,
      })
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

      const payload: ShopSettingsData = {
        ...formData,
        address: composeAddress(
          {
            line1: addressFields.addressLine1,
            line2: addressFields.addressLine2,
            city: addressFields.city,
            district: addressFields.district,
            postalCode: addressFields.postalCode,
          },
          { includeState: false }
        ),
        city: addressFields.city,
        pincode: addressFields.postalCode,
      }

      const response = await fetch("/api/settings/shop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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
      const parsedAddress = parseAddress(sanitizedData.address)
      setAddressFields({
        addressLine1: parsedAddress.line1 ?? "",
        addressLine2: parsedAddress.line2 ?? "",
        city: parsedAddress.city || sanitizedData.city,
        district: parsedAddress.district ?? "",
        postalCode: parsedAddress.postalCode || sanitizedData.pincode,
      })
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

  handleSaveRef.current = handleSave
  loadSettingsRef.current = loadSettings

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading shop settings...</div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0">
      <div className={`global-settings-panel border border-slate-200 bg-white ${panelCornerClass}`}>
        <div className="global-settings-content lock-desktop">
          <div className="global-settings-grid">
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
            className="global-settings-field"
          />
        </div>

        <div>
          <Label htmlFor="addressLine1" className="text-sm font-medium">
            Address Line 1
          </Label>
          <Input
            id="addressLine1"
            value={addressFields.addressLine1}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, addressLine1: e.target.value }))}
            disabled={isLoading}
            placeholder="Apartment, Suite, Unit, Building"
            className="global-settings-field"
          />
        </div>

        <div>
          <Label htmlFor="addressLine2" className="text-sm font-medium">
            Address Line 2
          </Label>
          <Input
            id="addressLine2"
            value={addressFields.addressLine2}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, addressLine2: e.target.value }))}
            disabled={isLoading}
            placeholder="Street address"
            className="global-settings-field"
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
            value={addressFields.city}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, city: e.target.value }))}
            disabled={isLoading}
            placeholder="Enter city"
            className="global-settings-field"
          />
        </div>

        <div>
          <Label htmlFor="district" className="text-sm font-medium">
            District
          </Label>
          <Input
            id="district"
            value={addressFields.district}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, district: e.target.value }))}
            disabled={isLoading}
            placeholder="Enter district"
            className="global-settings-field"
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
            value={addressFields.postalCode}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, postalCode: e.target.value }))}
            disabled={isLoading}
            placeholder="Enter pincode"
            className="global-settings-field"
          />
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
            className="global-settings-field"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Geo Location</Label>
          <div className="global-settings-geo-row">
            <Input
              id="garageLatitude"
              name="garageLatitude"
              value={formData.garageLatitude}
              onChange={(e) => handleChange("garageLatitude", e.target.value)}
              disabled={isLoading}
              placeholder="Latitude"
              className="global-settings-geo-input"
            />
            <Input
              id="garageLongitude"
              name="garageLongitude"
              value={formData.garageLongitude}
              onChange={(e) => handleChange("garageLongitude", e.target.value)}
              disabled={isLoading}
              placeholder="Longitude"
              className="global-settings-geo-input"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={useCurrentLocation}
              disabled={isLoading || isFetchingLocation}
              className="global-settings-geo-btn text-sky-600 hover:bg-sky-100 hover:text-sky-700"
              title="Use Current Location"
            >
              <LocateFixed className={`h-4 w-4 ${isFetchingLocation ? "animate-spin" : ""}`} />
            </Button>
          </div>
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
              className="global-settings-field"
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
            className="global-settings-field bg-slate-50"
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
            className="global-settings-field"
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
            className="global-settings-field"
          />
        </div>

        {/* Email */}
        <div>
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
            className="global-settings-field"
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
            onChange={(e) => handleChange("upiId", e.target.value.toLowerCase())}
            disabled={isLoading}
            placeholder="Enter UPI ID (e.g., garage@upi)"
            autoComplete="off"
            className="global-settings-field"
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
            className="global-settings-field"
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
            className="global-settings-field"
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
            className="global-settings-field"
          />
        </div>
          </div>
        </div>
      </div>
    </div>
  )
}

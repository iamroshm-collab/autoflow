"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from '@/components/ui/notify'
import { toUpperCase, toProperCase } from "@/lib/utils"
import { getMakes, getModels } from "@/lib/vehicle-catalog"
import { setupFormKeyboardNavigation } from "@/lib/keyboard-navigation"

interface AddVehicleModalProps {
  open: boolean
  customerId: string
  onOpenChange: (open: boolean) => void
  onVehicleAdded: (vehicle: any) => void
  // optional initial values to prefill when opening from registration lookup
  initialRegistration?: string
  initialMake?: string
  initialModel?: string
  initialYear?: string
  initialColor?: string
}

interface VehicleConflictState {
  open: boolean
  ownerName: string
  ownerMobileNo: string
}

export function AddVehicleModal({
  open,
  customerId,
  onOpenChange,
  onVehicleAdded,
  initialRegistration,
  initialMake,
  initialModel,
  initialYear,
  initialColor,
}: AddVehicleModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [vehicleConflict, setVehicleConflict] = useState<VehicleConflictState>({
    open: false,
    ownerName: "",
    ownerMobileNo: "",
  })
  const [formData, setFormData] = useState({
    registrationNumber: "",
    make: "",
    model: "",
    year: new Date().getFullYear().toString(),
    color: "",
  })
  const [showMakeDropdown, setShowMakeDropdown] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [makeHighlightedIndex, setMakeHighlightedIndex] = useState(-1)
  const [modelHighlightedIndex, setModelHighlightedIndex] = useState(-1)

  const makeOptions = useMemo(() => getMakes(), [])
  const filteredMakes = useMemo(
    () => makeOptions.filter((m) => m.toLowerCase().includes(formData.make.toLowerCase())).slice(0, 12),
    [makeOptions, formData.make],
  )

  const modelOptions = useMemo(() => getModels(formData.make), [formData.make])
  const filteredModels = useMemo(
    () => modelOptions.filter((m) => m.toLowerCase().includes(formData.model.toLowerCase())).slice(0, 12),
    [modelOptions, formData.model],
  )

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      console.log("Vehicle modal opened with customerId:", customerId)
      setFormData({
        registrationNumber: initialRegistration || "",
        make: initialMake || "",
        model: initialModel || "",
        year: initialYear || new Date().getFullYear().toString(),
        color: initialColor || "",
      })
      setVehicleConflict({
        open: false,
        ownerName: "",
        ownerMobileNo: "",
      })
      setShowMakeDropdown(false)
      setShowModelDropdown(false)
      setMakeHighlightedIndex(-1)
      setModelHighlightedIndex(-1)
    }
  }, [open, customerId])

  // Initialize keyboard navigation
  useEffect(() => {
    const dialogContent = document.querySelector('[role="dialog"]')
    if (dialogContent && open) {
      setupFormKeyboardNavigation(dialogContent as HTMLElement)
    }
  }, [open])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const submitVehicle = async (transferIfExists: boolean) => {
    try {
      if (!formData.registrationNumber.trim() || !formData.make.trim() || !formData.model.trim()) {
        toast.error("Registration number, make, and model are required")
        return
      }

      setIsLoading(true)

      // Convert data to proper formatting
      const submissionData = {
        registrationNumber: toUpperCase(formData.registrationNumber.trim()),
        make: toProperCase(formData.make.trim()),
        model: toProperCase(formData.model.trim()),
        year: formData.year,
        color: formData.color ? toProperCase(formData.color.trim()) : "",
        lastCustomerId: customerId,
        transferIfExists,
      }

      console.log("Submitting vehicle form:", submissionData)

      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      })

      console.log("Vehicle API response status:", response.status)

      const data = await response.json()

      console.log("Vehicle API response data:", data)

      if (!response.ok) {
        if (response.status === 409 && data.code === "VEHICLE_EXISTS_OTHER_CUSTOMER") {
          setVehicleConflict({
            open: true,
            ownerName: data.existingVehicle?.customerName || "another customer",
            ownerMobileNo: data.existingVehicle?.customerMobileNo || "",
          })
          return
        }

        throw new Error(data.error || "Failed to create vehicle")
      }

      const vehicle = data
      console.log("Vehicle created successfully:", vehicle)
      if (vehicle?.transferred) {
        toast.success("Vehicle moved and added successfully!")
      } else {
        toast.success("Vehicle added successfully!")
      }
      onVehicleAdded(vehicle)
      onOpenChange(false)
      setFormData({
        registrationNumber: "",
        make: "",
        model: "",
        year: new Date().getFullYear().toString(),
        color: "",
      })
    } catch (error) {
      console.error("Error creating vehicle:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to create vehicle"
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    await submitVehicle(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Add New Vehicle</DialogTitle>
            <DialogDescription>
              Add a new vehicle for the selected customer.
            </DialogDescription>
          </DialogHeader>

        <div className="border border-slate-200 rounded-lg bg-white p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="registrationNumber" className="font-semibold">
              Registration Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="registrationNumber"
              name="registrationNumber"
              value={formData.registrationNumber}
              onChange={handleInputChange}
              disabled={isLoading}
              maxLength={12}
              className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="make" className="font-semibold">
                Make <span className="text-red-500">*</span>
              </Label>
              <Input
                id="make"
                name="make"
                data-dropdown-trigger="true"
                data-dropdown-id="make-dropdown"
                value={formData.make}
                className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                onChange={(e) => {
                  const value = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    make: value,
                    model: "",
                  }))
                  if (makeOptions.length > 0) {
                    setShowMakeDropdown(true)
                    setMakeHighlightedIndex(-1)
                  }
                  setShowModelDropdown(false)
                  setModelHighlightedIndex(-1)
                }}
                onFocus={() => {
                  if (makeOptions.length > 0) {
                    setShowMakeDropdown(true)
                    setMakeHighlightedIndex(0)
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    if (filteredMakes.length === 1) {
                      setFormData((prev) => ({
                        ...prev,
                        make: filteredMakes[0],
                        model: "",
                      }))
                    }
                    setShowMakeDropdown(false)
                    setMakeHighlightedIndex(-1)
                  }, 80)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    setShowMakeDropdown(false)
                    if (makeHighlightedIndex >= 0 && filteredMakes[makeHighlightedIndex]) {
                      setFormData((prev) => ({
                        ...prev,
                        make: filteredMakes[makeHighlightedIndex],
                        model: "",
                      }))
                    } else if (filteredMakes.length === 1) {
                      setFormData((prev) => ({
                        ...prev,
                        make: filteredMakes[0],
                        model: "",
                      }))
                    }
                    setMakeHighlightedIndex(-1)
                    return
                  }

                  if (e.key === "ArrowDown") {
                    e.preventDefault()
                    if (filteredMakes.length > 0) {
                      setShowMakeDropdown(true)
                      setMakeHighlightedIndex((prev) => {
                        if (prev < 0) return 0
                        return prev < filteredMakes.length - 1 ? prev + 1 : 0
                      })
                    }
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    if (filteredMakes.length > 0) {
                      setShowMakeDropdown(true)
                      setMakeHighlightedIndex((prev) => {
                        if (prev < 0) return filteredMakes.length - 1
                        return prev > 0 ? prev - 1 : filteredMakes.length - 1
                      })
                    }
                  } else if (e.key === "Enter") {
                    e.preventDefault()
                    const selectedMake =
                      makeHighlightedIndex >= 0 && filteredMakes[makeHighlightedIndex]
                        ? filteredMakes[makeHighlightedIndex]
                        : filteredMakes.length === 1
                          ? filteredMakes[0]
                          : ""

                    if (selectedMake) {
                      setFormData((prev) => ({
                        ...prev,
                        make: selectedMake,
                        model: "",
                      }))
                      setShowMakeDropdown(false)
                      setMakeHighlightedIndex(-1)
                    }
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    setShowMakeDropdown(false)
                    setMakeHighlightedIndex(-1)
                  }
                }}
                disabled={isLoading}
                maxLength={50}
              />
              {filteredMakes.length > 0 && showMakeDropdown && (
                <div id="make-dropdown" className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 dropdown-scroll">
                  {filteredMakes.map((make, idx) => (
                    <button
                      key={make}
                      type="button"
                      tabIndex={0}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setFormData((prev) => ({
                          ...prev,
                          make,
                          model: "",
                        }))
                        setShowMakeDropdown(false)
                        setMakeHighlightedIndex(-1)
                      }}
                      className={`dropdown-item ${makeHighlightedIndex === idx ? "selected" : ""}`}
                    >
                      {make}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="model" className="font-semibold">
                Model <span className="text-red-500">*</span>
              </Label>
              <Input
                id="model"
                name="model"
                data-dropdown-trigger="true"
                data-dropdown-id="model-dropdown"
                value={formData.model}
                className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                onChange={(e) => {
                  const value = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    model: value,
                  }))
                  if (formData.make && modelOptions.length > 0) {
                    setShowModelDropdown(true)
                    setModelHighlightedIndex(-1)
                  }
                }}
                onFocus={() => {
                  if (formData.make && modelOptions.length > 0) {
                    setShowModelDropdown(true)
                    setModelHighlightedIndex(0)
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    if (filteredModels.length === 1) {
                      setFormData((prev) => ({
                        ...prev,
                        model: filteredModels[0],
                      }))
                    }
                    setShowModelDropdown(false)
                    setModelHighlightedIndex(-1)
                  }, 80)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    setShowModelDropdown(false)
                    if (modelHighlightedIndex >= 0 && filteredModels[modelHighlightedIndex]) {
                      setFormData((prev) => ({
                        ...prev,
                        model: filteredModels[modelHighlightedIndex],
                      }))
                    } else if (filteredModels.length === 1) {
                      setFormData((prev) => ({
                        ...prev,
                        model: filteredModels[0],
                      }))
                    }
                    setModelHighlightedIndex(-1)
                    return
                  }

                  if (e.key === "ArrowDown") {
                    e.preventDefault()
                    if (filteredModels.length > 0) {
                      setShowModelDropdown(true)
                      setModelHighlightedIndex((prev) => {
                        if (prev < 0) return 0
                        return prev < filteredModels.length - 1 ? prev + 1 : 0
                      })
                    }
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    if (filteredModels.length > 0) {
                      setShowModelDropdown(true)
                      setModelHighlightedIndex((prev) => {
                        if (prev < 0) return filteredModels.length - 1
                        return prev > 0 ? prev - 1 : filteredModels.length - 1
                      })
                    }
                  } else if (e.key === "Enter") {
                    e.preventDefault()
                    const selectedModel =
                      modelHighlightedIndex >= 0 && filteredModels[modelHighlightedIndex]
                        ? filteredModels[modelHighlightedIndex]
                        : filteredModels.length === 1
                          ? filteredModels[0]
                          : ""

                    if (selectedModel) {
                      setFormData((prev) => ({
                        ...prev,
                        model: selectedModel,
                      }))
                      setShowModelDropdown(false)
                      setModelHighlightedIndex(-1)
                    }
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    setShowModelDropdown(false)
                    setModelHighlightedIndex(-1)
                  }
                }}
                disabled={isLoading || !formData.make.trim()}
                maxLength={50}
              />
              {filteredModels.length > 0 && showModelDropdown && (
                <div id="model-dropdown" className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 dropdown-scroll">
                  {filteredModels.map((model, idx) => (
                    <button
                      key={model}
                      type="button"
                      tabIndex={0}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setFormData((prev) => ({
                          ...prev,
                          model,
                        }))
                        setShowModelDropdown(false)
                        setModelHighlightedIndex(-1)
                      }}
                      className={`dropdown-item ${modelHighlightedIndex === idx ? "selected" : ""}`}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year" className="font-semibold">Year</Label>
              <Input
                id="year"
                name="year"
                type="number"
                value={formData.year}
                onChange={handleInputChange}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color" className="font-semibold">Color</Label>
              <Input
                id="color"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>
          </div>
        </div>

          <DialogFooter className="flex gap-5 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Creating..." : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={vehicleConflict.open}
        onOpenChange={(isOpen) =>
          setVehicleConflict((prev) => ({
            ...prev,
            open: isOpen,
          }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vehicle Already Registered</AlertDialogTitle>
            <AlertDialogDescription>
              This vehicle is already registered under {vehicleConflict.ownerName}
              {vehicleConflict.ownerMobileNo ? ` (${vehicleConflict.ownerMobileNo})` : ""}. Do you want to remove it from that customer and assign it to this customer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              setVehicleConflict((prev) => ({ ...prev, open: false }))
              await submitVehicle(true)
            }}
          >
            Yes
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

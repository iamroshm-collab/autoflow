"use client"
import React, { useState } from "react"
import { AddVehicleModal } from "./dashboard/add-vehicle-modal"
import { AddCustomerModal } from "./dashboard/add-customer-modal"

type Vehicle = {
  id: string
  registrationNumber: string
  make: string
  model: string
  lastCustomer?: { id: string; name: string; mobileNo: string } | null
}

type Customer = { id: string; name: string; mobileNo: string }

type Props = {
  onVehicleCreated?: (registration: string) => void
  onCustomerCreated?: (mobileNo?: string) => void
}

export default function JobCardFormExample({ onVehicleCreated, onCustomerCreated }: Props) {
  const [registration, setRegistration] = useState("")
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addVehicleOpen, setAddVehicleOpen] = useState(false)
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const [pendingRegistration, setPendingRegistration] = useState<string | null>(null)
  const [pendingMobile, setPendingMobile] = useState<string | null>(null)

  async function handleRegistrationBlur() {
    const reg = registration.trim()
    if (!reg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vehicles/by-registration?registration=${encodeURIComponent(reg)}`)
      if (res.status === 404) {
        // Vehicle missing: if we have a customer, open AddVehicle modal.
        // Otherwise open AddCustomer modal first, then AddVehicle after creation.
        setPendingRegistration(reg)
        if (customer) {
          setAddVehicleOpen(true)
        } else {
          setAddCustomerOpen(true)
        }
        onVehicleCreated?.(reg)
        setVehicle(null)
        setLoading(false)
        return
      }

      if (!res.ok) throw new Error("Failed to fetch vehicle")
      const data: Vehicle = await res.json()
      setVehicle(data)
      if (data.lastCustomer) {
        setCustomer(data.lastCustomer as Customer)
      } else {
        setCustomer(null)
      }
    } catch (err: any) {
      setError(err?.message || "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleSearchCustomerByMobile(mobile: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/customers/by-mobile?mobile=${encodeURIComponent(mobile)}`)
      if (res.status === 404) {
        // Open add customer modal with mobile prefilled
        setPendingMobile(mobile)
        setAddCustomerOpen(true)
        onCustomerCreated?.(mobile)
        setCustomer(null)
        return
      }
      if (!res.ok) throw new Error("Failed to fetch customer")
      const data: Customer = await res.json()
      setCustomer(data)
    } catch (err: any) {
      setError(err?.message || "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveJobCard() {
    if (!vehicle) return setError("Vehicle is required")
    if (!customer) return setError("Customer is required")
    setLoading(true)
    setError(null)
    try {
      const payload = {
        jobCardNumber: `JC-${Date.now()}`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        serviceDate: new Date().toISOString(),
      }

      const res = await fetch(`/api/jobcards/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error || "Failed to save jobcard")
      }

      const created = await res.json()
      // Success: update local state
      setVehicle((v) => (v ? { ...v, lastCustomer: { id: customer.id, name: customer.name, mobileNo: customer.mobileNo } } : v))
      return created
    } catch (err: any) {
      setError(err?.message || "Unknown error")
      return null
    } finally {
      setLoading(false)
    }
  }

  function handleVehicleAdded(vehicleData: any) {
    // vehicleData should include id, registrationNumber
    const v = {
      id: vehicleData.id,
      registrationNumber: vehicleData.registrationNumber,
      make: vehicleData.make,
      model: vehicleData.model,
      lastCustomer: vehicleData.customer ? { id: vehicleData.customer.id, name: vehicleData.customer.name, mobileNo: vehicleData.customer.mobileNo } : null,
    }
    setVehicle(v)
    setAddVehicleOpen(false)
    setPendingRegistration(null)
  }

  function handleCustomerAdded(customerData: any) {
    const c = { id: customerData.id, name: customerData.name, mobileNo: customerData.mobileNo }
    setCustomer(c)
    setAddCustomerOpen(false)
    // If we were creating a vehicle for this registration, open vehicle modal next
    if (pendingRegistration) {
      setAddVehicleOpen(true)
    }
    setPendingMobile(null)
  }

  return (
    <div>
      <h3>JobCard — Vehicle First (Example)</h3>
      <div>
        <label htmlFor="registration">Registration</label>
        <input
          id="registration"
          name="registration"
          value={registration}
          onChange={(e) => setRegistration(e.target.value)}
          onBlur={handleRegistrationBlur}
          placeholder="Enter registration"
        />
      </div>

      <div>
        <strong>Vehicle:</strong> {vehicle ? `${vehicle.registrationNumber} — ${vehicle.make} ${vehicle.model}` : "(none)"}
      </div>

      <div>
        <label htmlFor="customer-mobile">Customer Mobile</label>
        <input
          id="customer-mobile"
          name="customerMobile"
          defaultValue={customer?.mobileNo || ""}
          onBlur={(e) => handleSearchCustomerByMobile(e.target.value)}
          placeholder="Search by mobile"
        />
      </div>

      <div>
        <strong>Customer:</strong> {customer ? `${customer.name} (${customer.mobileNo})` : "(none)"}
      </div>

      <div>
        <button onClick={() => handleSaveJobCard()} disabled={loading}>
          {loading ? "Saving..." : "Save JobCard"}
        </button>
      </div>

      {error && <div style={{ color: "red" }}>{error}</div>}
      <AddVehicleModal open={addVehicleOpen} customerId={customer?.id || ""} onOpenChange={setAddVehicleOpen} onVehicleAdded={handleVehicleAdded} />
      <AddCustomerModal open={addCustomerOpen} mobileNumber={pendingMobile || ""} onOpenChange={setAddCustomerOpen} onCustomerAdded={handleCustomerAdded} />
    </div>
  )
}

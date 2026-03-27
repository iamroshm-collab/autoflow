"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { notify } from "@/components/ui/notify"

export default function CompleteProfilePage() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [prefillName, setPrefillName] = useState("")
  const [prefillMobile, setPrefillMobile] = useState("")

  const [mobile, setMobile] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")

  useEffect(() => {
    let mounted = true

    const loadCurrentUser = async () => {
      setCheckingSession(true)
      setError("")
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        if (!response.ok) {
          router.replace("/login")
          return
        }

        const data = await response.json()
        const user = data?.user
        if (!user) {
          router.replace("/login")
          return
        }

        if (user.approvalStatus !== "approved") {
          router.replace("/login")
          return
        }

        if (!user.profileIncomplete) {
          router.replace("/")
          return
        }

        if (!mounted) {
          return
        }

        setPrefillName(String(user.name || ""))
        setPrefillMobile(String(user.mobile || ""))
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : "Failed to load session")
      } finally {
        if (mounted) {
          setCheckingSession(false)
        }
      }
    }

    void loadCurrentUser()

    return () => {
      mounted = false
    }
  }, [router])

  const submit = async () => {
    const fields = [
      { label: "Mobile", value: mobile },
      { label: "Aadhaar ID", value: idNumber },
      { label: "Address Line 1", value: addressLine1 },
      { label: "Address Line 2", value: addressLine2 },
      { label: "City", value: city },
      { label: "State", value: state },
      { label: "Postal Code", value: postalCode },
    ]
    const missing = fields.find((f) => !f.value.trim())
    if (missing) {
      notify.error(`${missing.label} is required`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile,
          idNumber,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        notify.error(data.error || "Failed to save profile")
        return
      }
      notify.success("Profile completed. Access granted.")
      router.replace("/")
    } catch {
      notify.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-4 text-center">
          <p className="text-sm text-slate-600">Loading your profile...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Complete Your Profile</h1>
          <p className="text-sm text-slate-500">
            Hi{prefillName ? ` ${prefillName}` : ""}! Your admin has approved access. Fill the required details to enter the app.
          </p>
          {prefillMobile && (
            <p className="text-xs text-slate-400 truncate">Signed in as {prefillMobile}</p>
          )}
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit mobile number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="aadhaar">Aadhaar ID</Label>
          <Input
            id="aadhaar"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="12-digit Aadhaar number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address-line-1">Address Line 1 (Apartment, Suite, Unit, Building)</Label>
          <Input id="address-line-1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address-line-2">Address Line 2 (Street Address)</Label>
          <Input id="address-line-2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal">Postal Code</Label>
            <Input id="postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </div>
        </div>

        <p className="text-xs text-slate-500">All fields are mandatory. Missing details will block app access.</p>

        <Button type="button" onClick={submit} disabled={loading} className="w-full">
          {loading ? "Saving..." : "Save And Continue"}
        </Button>

        <button
          type="button"
          className="w-full text-sm text-slate-500 hover:text-slate-700"
          onClick={() => router.replace("/login")}
        >
          Cancel and go back to Login
        </button>
      </div>
    </main>
  )
}

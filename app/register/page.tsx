"use client"

import Link from "next/link"
import { useEffect, useRef, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authService, AuthServiceError } from "@/services/authService"
import { enableApprovalPushAlias } from "@/lib/onesignal-web"
import { normalizeMobileNumber } from "@/lib/mobile-validation"

type RegistrationRole = "technician" | "customer"

function RegisterForm() {
  const searchParams = useSearchParams()
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState("")
  const [aadhar, setAadhar] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [district, setDistrict] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [mobile, setMobile] = useState("")
  const [role, setRole] = useState<RegistrationRole>("technician")
  const [otp, setOtp] = useState("")
  const [otpRequested, setOtpRequested] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const mobileParam = searchParams.get("mobile")
    if (mobileParam) {
      setMobile(mobileParam)
      // Focus on name field after a small delay to ensure DOM is ready
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 0)
    }
  }, [searchParams])

  const composeAddress = () => {
    const parts = [addressLine1, addressLine2, city, district, postalCode].filter(p => p.trim())
    return parts.join(", ")
  }

  const submit = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await authService.register({
        name,
        aadhar,
        address: composeAddress(),
        mobile: normalizeMobileNumber(mobile),
        role,
      })
      setOtpRequested(true)
      setMessage("OTP sent to your WhatsApp number. Enter OTP to complete registration.")
    } catch (submitError) {
      setError(submitError instanceof AuthServiceError ? submitError.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await authService.verifyRegisterOtp(normalizeMobileNumber(mobile), otp)
      try {
        await enableApprovalPushAlias(normalizeMobileNumber(mobile))
      } catch (pushSetupError) {
        console.warn("[REGISTER_PUSH_ALIAS_SETUP_FAILED]", pushSetupError)
      }

      setMessage("Registration completed. Wait for admin approval before login.")
      setName("")
      setAadhar("")
      setAddressLine1("")
      setAddressLine2("")
      setCity("")
      setDistrict("")
      setPostalCode("")
      setMobile("")
      setOtp("")
      setOtpRequested(false)
    } catch (submitError) {
      setError(submitError instanceof AuthServiceError ? submitError.message : "OTP verification failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">AutoFlow</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input 
            id="name" 
            ref={nameInputRef}
            value={name} 
            onChange={(event) => setName(event.target.value)} 
            placeholder="John Doe" 
            required 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="aadhar">Aadhar</Label>
          <Input
            id="aadhar"
            value={aadhar}
            onChange={(event) => setAadhar(event.target.value.replace(/\D/g, "").slice(0, 12))}
            inputMode="numeric"
            maxLength={12}
            placeholder="12-digit Aadhar number"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="addressLine1">Address Line 1</Label>
          <Input
            id="addressLine1"
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
            placeholder="Apartment, Suite, Unit, Building"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="addressLine2">Address Line 2</Label>
          <Input
            id="addressLine2"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
            placeholder="Street Address"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="City"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="district">District</Label>
          <Input
            id="district"
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
            placeholder="District"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit postal code"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Account Type</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("technician")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                role === "technician"
                  ? "border-sky-600 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              Employee
            </button>
            <button
              type="button"
              onClick={() => setRole("customer")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                role === "customer"
                  ? "border-sky-600 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              Customer
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile">WhatsApp Number</Label>
          <Input
            id="mobile"
            value={mobile}
            onChange={(event) => setMobile(normalizeMobileNumber(event.target.value))}
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit WhatsApp number"
            required
            readOnly={searchParams.get("mobile") !== null}
          />
        </div>

        {otpRequested ? (
          <div className="space-y-2">
            <Label htmlFor="otp">WhatsApp OTP</Label>
            <Input
              id="otp"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit OTP"
            />
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        {!otpRequested ? (
          <Button
            type="button"
            onClick={submit}
            disabled={loading || !name.trim() || aadhar.length !== 12 || !addressLine1.trim() || !addressLine2.trim() || !city.trim() || !district.trim() || postalCode.length !== 6 || mobile.length !== 10}
            className="w-full"
          >
            {loading ? "Sending OTP..." : "Register and Send OTP"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button type="button" onClick={verifyOtp} disabled={loading || otp.length !== 6} className="w-full">
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>
            <Button type="button" variant="outline" onClick={submit} disabled={loading} className="w-full">
              Resend OTP
            </Button>
          </div>
        )}

        <p className="text-sm text-slate-500 text-center">
          <Link href="/login" className="text-sky-700 hover:text-sky-800">Login</Link>
        </p>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
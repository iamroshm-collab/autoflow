"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseAddress } from "@/lib/address-utils"
import { notify } from "@/components/ui/notify"

type PendingUser = {
  id: string
  name: string
  mobile: string | null
  role: "admin" | "manager" | "technician"
  address?: string | null
  idNumber?: string | null
  designation?: string | null
  approvalStatus: string
  createdAt: string
}

type DeviceRequestUser = {
  id: string
  name: string
  mobile: string | null
  role: "admin" | "manager" | "technician"
  employeeRefId?: number | null
  approvedDeviceId?: string | null
  approvedDeviceIp?: string | null
  pendingDeviceId?: string | null
  pendingDeviceIp?: string | null
  updatedAt: string
}

type ApprovalProfile = {
  accessRole: "" | "technician" | "supervisor" | "manager" | "accountant" | "office-staff"
  mobile: string
  designation: string
  facePhotoUrl: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
}

const createEmptyProfile = (): ApprovalProfile => ({
  accessRole: "",
  mobile: "",
  designation: "",
  facePhotoUrl: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
})

export default function ApprovalsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [requests, setRequests] = useState<PendingUser[]>([])
  const [deviceRequests, setDeviceRequests] = useState<DeviceRequestUser[]>([])
  const [activeDevices, setActiveDevices] = useState<DeviceRequestUser[]>([])
  const [showPendingDeviceOnly, setShowPendingDeviceOnly] = useState(false)
  const [profiles, setProfiles] = useState<Record<string, ApprovalProfile>>({})
  const [cameraUserId, setCameraUserId] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState("")
  const [cameraBusy, setCameraBusy] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const isMountedRef = useRef(true)

  const visibleDeviceRequests = deviceRequests
  const visibleActiveDevices = showPendingDeviceOnly ? [] : activeDevices

  const updateProfile = (userId: string, patch: Partial<ApprovalProfile>) => {
    setProfiles((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || createEmptyProfile()),
        ...patch,
      },
    }))
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
    }
    setCameraStream(null)
    setCameraUserId(null)
  }

  const toggleCamera = async () => {
    const newFacing = cameraFacing === "environment" ? "user" : "environment"
    setCameraFacing(newFacing)
    
    if (cameraUserId && cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing },
          audio: false,
        })
        if (isMountedRef.current) {
          setCameraStream(stream)
        } else {
          stream.getTracks().forEach((track) => track.stop())
        }
      } catch (error) {
        if (isMountedRef.current) {
          setCameraError(error instanceof Error ? error.message : "Unable to switch camera")
        }
      }
    }
  }

  const startCamera = async (userId: string) => {
    setCameraError("")
    setCameraBusy(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing },
        audio: false,
      })

      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }

      if (isMountedRef.current) {
        setCameraStream(stream)
        setCameraUserId(userId)
      } else {
        stream.getTracks().forEach((track) => track.stop())
      }
    } catch (error) {
      if (isMountedRef.current) {
        setCameraError(error instanceof Error ? error.message : "Unable to access camera")
      }
    } finally {
      if (isMountedRef.current) {
        setCameraBusy(false)
      }
    }
  }

  const uploadEmployeePhoto = async (userId: string, employeeName: string, file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("employeeName", employeeName || "employee")

    const response = await fetch("/api/uploads/employee-photo", {
      method: "POST",
      body: formData,
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || "Failed to upload employee photo")
    }

    if (isMountedRef.current) {
      updateProfile(userId, { facePhotoUrl: String(data.photoUrl || "") })
      notify.success("Employee photo saved")
    }
  }

  const captureLivePhoto = async (userId: string, employeeName: string) => {
    if (!videoRef.current) {
      notify.error("Camera preview is not ready")
      return
    }

    const video = videoRef.current
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")

    if (!context) {
      notify.error("Unable to capture photo")
      return
    }

    context.drawImage(video, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((capturedBlob) => resolve(capturedBlob), "image/jpeg", 0.92)
    })

    if (!blob) {
      notify.error("Unable to capture photo")
      return
    }

    const file = new File([blob], `${employeeName || "employee"}-${Date.now()}.jpg`, { type: "image/jpeg" })

    try {
      if (isMountedRef.current) {
        setCameraBusy(true)
      }
      await uploadEmployeePhoto(userId, employeeName, file)
      if (isMountedRef.current) {
        stopCamera()
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save captured photo")
    } finally {
      if (isMountedRef.current) {
        setCameraBusy(false)
      }
    }
  }

  useEffect(() => {
    if (cameraUserId && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream
      void videoRef.current.play().catch(() => {
        if (isMountedRef.current) {
          setCameraError("Unable to start camera preview")
        }
      })
    }
  }, [cameraUserId, cameraStream])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [cameraStream])

  const loadRequests = async () => {
    setLoading(true)
    setError("")
    try {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" })
      if (!meRes.ok) {
        router.replace("/login")
        return
      }

      const response = await fetch("/api/auth/pending-users", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to load approvals")
      }

      const incomingRequests = Array.isArray(data.requests) ? data.requests : []
      const incomingDeviceRequests = Array.isArray(data.deviceRequests) ? data.deviceRequests : []
      const incomingActiveDevices = Array.isArray(data.activeDevices) ? data.activeDevices : []
      
      if (isMountedRef.current) {
        // Apply optional query filters if supplied
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
        const qUserId = params.get('userId')
        const qMobile = params.get('mobile')

        let filteredRequests = incomingRequests
        if (qUserId) {
          const match = incomingRequests.find((u) => u.id === qUserId)
          filteredRequests = match ? [match] : []
        } else if (qMobile) {
          const normalizeMobile = (m?: string | null) => {
            if (!m) return ""
            const digits = String(m).replace(/\D/g, "")
            return digits.length <= 10 ? digits : digits.slice(-10)
          }
          const qNorm = normalizeMobile(qMobile)
          const match = incomingRequests.find((u) => normalizeMobile(u.mobile) === qNorm)
          filteredRequests = match ? [match] : []
        }

        setRequests(filteredRequests)
        setDeviceRequests(qUserId || qMobile ? [] : incomingDeviceRequests)
        setActiveDevices(qUserId || qMobile ? [] : incomingActiveDevices)

        setProfiles((prev) => {
          const next = { ...prev }
          incomingRequests.forEach((item: PendingUser) => {
            const parsed = parseAddress(item.address)
            next[item.id] = {
              accessRole: "",
              mobile: String(item.mobile || ""),
              designation: "",
              facePhotoUrl: "",
              addressLine1: String(parsed.line1 || ""),
              addressLine2: String(parsed.line2 || ""),
              city: String(parsed.city || ""),
              state: String(parsed.state || ""),
              postalCode: String(parsed.postalCode || ""),
            }
          })
          return next
        })
      }
    } catch (loadError) {
      if (isMountedRef.current) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load")
        setRequests([])
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadRequests()
  }, [])

  const handleAction = async (userId: string, action: "approve" | "reject") => {
    try {
      const profile = profiles[userId] || createEmptyProfile()

      if (action === "approve" && !profile?.accessRole) {
        notify.error("Please select a role before approval.")
        return
      }

      if (action === "approve" && !profile?.designation) {
        notify.error("Please select a designation before approval.")
        return
      }

      if (action === "approve" && !profile?.facePhotoUrl) {
        notify.error("Please capture or upload an employee photo before approval.")
        return
      }

      const response = await fetch("/api/auth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, ...profile }),
      })

      const data = await response.json()
      if (!response.ok) {
        notify.error(data.error || "Failed action")
        throw new Error(data.error || "Failed action")
      }

      await loadRequests()
    } catch (actionError) {
      if (isMountedRef.current) {
        setError(actionError instanceof Error ? actionError.message : "Failed action")
      }
    }
  }

  const handleDeviceAction = async (userId: string, action: "approve-device" | "deregister-device") => {
    try {
      const response = await fetch("/api/auth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      })

      const data = await response.json()
      if (!response.ok) {
        notify.error(data.error || "Failed device action")
        throw new Error(data.error || "Failed device action")
      }

      notify.success(action === "approve-device" ? "Device approved" : "Device de-registered")
      await loadRequests()
    } catch (actionError) {
      if (isMountedRef.current) {
        setError(actionError instanceof Error ? actionError.message : "Failed device action")
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Select Role to Approve Access</h1>
            <p className="text-sm text-slate-500">Approve registrations, manage device approvals, and let the system generate an employee ID during approval if needed.</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/")}>Back to Dashboard</Button>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {!loading && (deviceRequests.length > 0 || activeDevices.length > 0) ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Device Approval Quick Filter</p>
                <p className="text-xs text-slate-500">Focus only on pending device approvals when needed.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={showPendingDeviceOnly ? "default" : "outline"}
                  onClick={() => setShowPendingDeviceOnly((prev) => !prev)}
                >
                  {showPendingDeviceOnly ? "Pending Only Enabled" : "Show Pending Device Only"}
                </Button>
                {showPendingDeviceOnly ? (
                  <Button size="sm" variant="ghost" onClick={() => setShowPendingDeviceOnly(false)}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-500">No pending registration requests.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((item) => {
              const profile = profiles[item.id] || createEmptyProfile()
              return (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/40 p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Name</p>
                        <p className="font-medium text-slate-900">{item.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Mobile</p>
                        <p className="text-slate-900">{item.mobile || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Requested At</p>
                        <p className="text-slate-900">{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-800">Employee Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1 md:col-span-2">
                          <Label htmlFor={`access-role-${item.id}`} className="text-xs">Select Role to Approve Access</Label>
                          <select
                            id={`access-role-${item.id}`}
                            value={profile.accessRole}
                            onChange={(event) => updateProfile(item.id, { accessRole: event.target.value as ApprovalProfile["accessRole"] })}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">Select Role</option>
                            <option value="technician">Technician</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="manager">Manager</option>
                            <option value="accountant">Accountant</option>
                            <option value="office-staff">Office Staff</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`mobile-${item.id}`} className="text-xs">Mobile</Label>
                          <Input
                            id={`mobile-${item.id}`}
                            value={profile.mobile}
                            onChange={(event) => updateProfile(item.id, { mobile: event.target.value.replace(/\D/g, "").slice(0, 10) })}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`designation-${item.id}`} className="text-xs">Designation</Label>
                          <select
                            id={`designation-${item.id}`}
                            value={profile.designation}
                            onChange={(event) => updateProfile(item.id, { designation: event.target.value })}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">Select Designation</option>
                            <option value="Mechanic">Mechanic</option>
                            <option value="Electrician">Electrician</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="Manager">Manager</option>
                            <option value="AC Technician">AC Technician</option>
                            <option value="Denter">Denter</option>
                            <option value="Painter">Painter</option>
                            <option value="Patch Worker">Patch Worker</option>
                            <option value="Welder">Welder</option>
                            <option value="Helper">Helper</option>
                            <option value="Driver">Driver</option>
                            <option value="Office Boy">Office Boy</option>
                            <option value="Receptionist">Receptionist</option>
                          </select>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-xs">Employee Photo (Mandatory - Live Capture Only)</Label>
                          <p className="text-[11px] text-slate-500">Use Take Live Picture to capture a photo with the device camera.</p>
                          <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3">
                            <div className="h-40 w-32 overflow-hidden rounded border border-slate-200 bg-slate-100 relative">
                              <Image
                                src={profile.facePhotoUrl || "/dummy-profile.svg"}
                                alt={`${item.name} photo preview`}
                                fill
                                className={profile.facePhotoUrl ? "object-cover" : "object-contain p-3"}
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => startCamera(item.id)}
                                disabled={cameraBusy}
                              >
                                Take Live Picture
                              </Button>
                            </div>

                            {cameraUserId === item.id ? (
                              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                                <video ref={videoRef} className="h-56 w-full rounded bg-black object-cover" autoPlay muted playsInline />
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => captureLivePhoto(item.id, item.name)}
                                    disabled={cameraBusy}
                                  >
                                    Capture Live Photo
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={toggleCamera}
                                    disabled={cameraBusy}
                                  >
                                    Switch Camera ({cameraFacing === "environment" ? "Back" : "Front"})
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={stopCamera}
                                    disabled={cameraBusy}
                                  >
                                    Close Camera
                                  </Button>
                                </div>
                                {cameraError ? <p className="text-xs text-rose-600">{cameraError}</p> : null}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <Label htmlFor={`address-line-1-${item.id}`} className="text-xs">Address Line 1 (Apartment, Suite, Unit, Building, Floor)</Label>
                          <Input
                            id={`address-line-1-${item.id}`}
                            value={profile.addressLine1}
                            onChange={(event) => updateProfile(item.id, { addressLine1: event.target.value })}
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <Label htmlFor={`address-line-2-${item.id}`} className="text-xs">Address Line 2 (Street Address)</Label>
                          <Input
                            id={`address-line-2-${item.id}`}
                            value={profile.addressLine2}
                            onChange={(event) => updateProfile(item.id, { addressLine2: event.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`city-${item.id}`} className="text-xs">City</Label>
                          <Input
                            id={`city-${item.id}`}
                            value={profile.city}
                            onChange={(event) => updateProfile(item.id, { city: event.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`state-${item.id}`} className="text-xs">State</Label>
                          <Input
                            id={`state-${item.id}`}
                            value={profile.state}
                            onChange={(event) => updateProfile(item.id, { state: event.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`postal-${item.id}`} className="text-xs">Postal Code</Label>
                          <Input
                            id={`postal-${item.id}`}
                            value={profile.postalCode}
                            onChange={(event) => updateProfile(item.id, { postalCode: event.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          className="bg-green-600 text-white hover:bg-green-700"
                          onClick={() => handleAction(item.id, "approve")}
                          disabled={!profile.accessRole || !profile.designation || !profile.facePhotoUrl}
                        >
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction(item.id, "reject")}>Reject</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && visibleDeviceRequests.length > 0 ? (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pending Device Approvals</h2>
              <p className="text-sm text-slate-500">Approve new-device logins before the employee can enter the app.</p>
            </div>

            <div className="space-y-3">
              {visibleDeviceRequests.map((item) => (
                <div key={`device-request-${item.id}`} className="rounded-lg border border-slate-200 bg-amber-50/50 p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Employee</p>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-slate-700">{item.mobile || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Requested At</p>
                      <p className="text-slate-900">{new Date(item.updatedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Current Approved Device</p>
                      <p className="text-slate-900 break-all">{item.approvedDeviceId || "None"}</p>
                      <p className="text-slate-600 break-all">IP: {item.approvedDeviceIp || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Requested New Device</p>
                      <p className="text-slate-900 break-all">{item.pendingDeviceId || "-"}</p>
                      <p className="text-slate-600 break-all">IP: {item.pendingDeviceIp || "-"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 text-white hover:bg-green-700"
                      onClick={() => handleDeviceAction(item.id, "approve-device")}
                    >
                      Approve New Device
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeviceAction(item.id, "deregister-device")}
                    >
                      De-register Device
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && showPendingDeviceOnly && visibleDeviceRequests.length === 0 ? (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-500">No pending device approvals right now.</p>
          </div>
        ) : null}

        {!loading && visibleActiveDevices.length > 0 ? (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Registered Devices</h2>
              <p className="text-sm text-slate-500">Use de-register when an employee changes phone/device.</p>
            </div>

            <div className="space-y-2">
              {visibleActiveDevices.map((item) => (
                <div key={`active-device-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">{item.name} ({item.mobile || "-"})</p>
                    <p className="text-slate-700 break-all">Device: {item.approvedDeviceId}</p>
                    <p className="text-slate-600 break-all">IP: {item.approvedDeviceIp || "-"}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeviceAction(item.id, "deregister-device")}
                  >
                    De-register Device
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}

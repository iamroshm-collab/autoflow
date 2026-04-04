"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
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

interface ApprovalsModuleProps {
  filterUserId?: string | null
  filterMobile?: string | null
}

export function ApprovalsModule({ filterUserId, filterMobile }: ApprovalsModuleProps = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [requests, setRequests] = useState<PendingUser[]>([])
  const [deviceRequests, setDeviceRequests] = useState<DeviceRequestUser[]>([])
  const [activeDevices, setActiveDevices] = useState<DeviceRequestUser[]>([])
  const [profiles, setProfiles] = useState<Record<string, ApprovalProfile>>({})
  const [cameraUserId, setCameraUserId] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState("")
  const [cameraBusy, setCameraBusy] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment")
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const updateProfile = (userId: string, patch: Partial<ApprovalProfile>) => {
    setProfiles((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] || createEmptyProfile()), ...patch },
    }))
  }

  const stopCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop())
    setCameraStream(null)
    setCameraUserId(null)
  }

  const toggleCamera = async () => {
    const newFacing = cameraFacing === "environment" ? "user" : "environment"
    setCameraFacing(newFacing)
    if (cameraUserId && cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing }, audio: false })
        setCameraStream(stream)
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : "Unable to switch camera")
      }
    }
  }

  const startCamera = async (userId: string) => {
    setCameraError("")
    setCameraBusy(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacing }, audio: false })
      if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(stream); setCameraUserId(userId)
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Unable to access camera")
    } finally {
      setCameraBusy(false)
    }
  }

  const uploadEmployeePhoto = async (userId: string, employeeName: string, file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("employeeName", employeeName || "employee")
    const response = await fetch("/api/uploads/employee-photo", { method: "POST", body: formData })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Failed to upload employee photo")
    updateProfile(userId, { facePhotoUrl: String(data.photoUrl || "") })
    notify.success("Employee photo saved")
  }

  const captureLivePhoto = async (userId: string, employeeName: string) => {
    if (!videoRef.current) { notify.error("Camera preview is not ready"); return }
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext("2d")
    if (!ctx) { notify.error("Unable to capture photo"); return }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92))
    if (!blob) { notify.error("Unable to capture photo"); return }
    const file = new File([blob], `${employeeName || "employee"}-${Date.now()}.jpg`, { type: "image/jpeg" })
    try {
      setCameraBusy(true)
      await uploadEmployeePhoto(userId, employeeName, file)
      stopCamera()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to save captured photo")
    } finally {
      setCameraBusy(false)
    }
  }

  useEffect(() => {
    if (cameraUserId && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream
      void videoRef.current.play().catch(() => {
        setCameraError("Unable to start camera preview")
      })
    }
  }, [cameraUserId, cameraStream])

  // Stop camera tracks when stream changes or component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop())
    }
  }, [cameraStream])

  const loadRequests = async (fId?: string | null, fm?: string | null) => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/auth/pending-users", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load approvals")

      const incomingRequests: PendingUser[] = Array.isArray(data.requests) ? data.requests : []
      const incomingDeviceRequests: DeviceRequestUser[] = Array.isArray(data.deviceRequests) ? data.deviceRequests : []
      const incomingActiveDevices: DeviceRequestUser[] = Array.isArray(data.activeDevices) ? data.activeDevices : []

      // Normalize mobiles to compare only digit sequences (last 10 digits)
      const normalizeMobile = (m?: string | null) => {
        if (!m) return ""
        const digits = String(m).replace(/\D/g, "")
        return digits.length <= 10 ? digits : digits.slice(-10)
      }

      let filteredRequests: PendingUser[]
      if (fId) {
        // filter by exact database ID — most reliable
        const match = incomingRequests.find((u) => u.id === fId)
        filteredRequests = match ? [match] : []
      } else if (fm) {
        const fmNorm = normalizeMobile(fm)
        const match = incomingRequests.find((u) => normalizeMobile(u.mobile) === fmNorm)
        filteredRequests = match ? [match] : []
      } else {
        filteredRequests = incomingRequests
      }
      setRequests(filteredRequests)
      setDeviceRequests(fId || fm ? [] : incomingDeviceRequests)
      setActiveDevices(fId || fm ? [] : incomingActiveDevices)
      setProfiles((prev) => {
        const next = { ...prev }
        filteredRequests.forEach((item) => {
          if (next[item.id]) return
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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load")
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadRequests(filterUserId, filterMobile) }, [filterUserId, filterMobile])

  const handleAction = async (userId: string, action: "approve" | "reject") => {
    const profile = profiles[userId] || createEmptyProfile()
    if (action === "approve") {
      if (!profile.accessRole) { notify.error("Please select a role before approval."); return }
      if (!profile.designation) { notify.error("Please select a designation before approval."); return }
      if (!profile.facePhotoUrl) { notify.error("Please capture an employee photo before approval."); return }
    }
    try {
      const response = await fetch("/api/auth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, ...profile }),
      })
      const data = await response.json()
      if (!response.ok) { notify.error(data.error || "Failed action"); return }
      notify.success(action === "approve" ? "Registration approved" : "Registration rejected")
      await loadRequests(filterUserId, filterMobile)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed action")
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
      if (!response.ok) { notify.error(data.error || "Failed device action"); return }
      notify.success(action === "approve-device" ? "Device approved" : "Device de-registered")
      await loadRequests(filterUserId, filterMobile)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed device action")
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading requests...</p>

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-4 pb-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {/* Registration requests */}
      {requests.length === 0 ? (
        <p className="text-sm text-slate-500">
          {filterUserId || filterMobile
            ? "This request has already been approved or rejected."
            : "No pending registration requests."}
        </p>
      ) : (
        <div className={`space-y-4 ${requests.length === 1 ? "h-full" : ""}`}>
          {requests.map((item) => {
            const profile = profiles[item.id] || createEmptyProfile()
            const singleCardClass = requests.length === 1 ? "h-full flex flex-col justify-between" : ""
            return (
              <div key={item.id} className={`rounded-xl border border-slate-200 bg-white p-4 ${singleCardClass}`}>
                 <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 ${requests.length === 1 ? 'flex-1' : ''}`}>
                  {/* Left: requester info */}
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

                  {/* Right: approval fields */}
                  <div className="lg:col-span-2 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-800">Employee Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                      <div className="space-y-1">
                        <Label htmlFor={`access-role-${item.id}`} className="text-xs">Role</Label>
                        <select
                          id={`access-role-${item.id}`}
                          value={profile.accessRole}
                          onChange={(e) => updateProfile(item.id, { accessRole: e.target.value as ApprovalProfile["accessRole"] })}
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
                        <Label htmlFor={`designation-${item.id}`} className="text-xs">Designation</Label>
                        <select
                          id={`designation-${item.id}`}
                          value={profile.designation}
                          onChange={(e) => updateProfile(item.id, { designation: e.target.value })}
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

                      {/* Photo capture */}
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs">Employee Photo (Mandatory — Live Capture Only)</Label>
                        <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="h-40 w-32 overflow-hidden rounded border border-slate-200 bg-slate-100 relative">
                            <Image
                              src={profile.facePhotoUrl || "/dummy-profile.svg"}
                              alt={`${item.name} photo preview`}
                              fill
                              className={profile.facePhotoUrl ? "object-cover" : "object-contain p-3"}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => startCamera(item.id)} disabled={cameraBusy}>
                              Take Live Picture
                            </Button>
                          </div>
                          {cameraUserId === item.id && (
                            <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2">
                              <video ref={videoRef} className="h-56 w-full rounded bg-black object-cover" autoPlay muted playsInline />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" size="sm" onClick={() => captureLivePhoto(item.id, item.name)} disabled={cameraBusy}>
                                  Capture Photo
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={toggleCamera} disabled={cameraBusy}>
                                  Switch ({cameraFacing === "environment" ? "Back" : "Front"})
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={stopCamera} disabled={cameraBusy}>
                                  Close
                                </Button>
                              </div>
                              {cameraError ? <p className="text-xs text-rose-600">{cameraError}</p> : null}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>

                    <div className={requests.length === 1 ? "flex items-center justify-end gap-2 mt-0" : "flex items-center justify-end gap-2 mt-8"}>
                      <Button
                        size="sm"
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => handleAction(item.id, "approve")}
                        disabled={!profile.accessRole || !profile.designation || !profile.facePhotoUrl}
                      >
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleAction(item.id, "reject")}>
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pending device approvals */}
      {deviceRequests.length > 0 && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pending Device Approvals</h2>
            <p className="text-xs text-slate-500">Approve new-device logins before the employee can enter the app.</p>
          </div>
          <div className="space-y-3">
            {deviceRequests.map((item) => (
              <div key={`dr-${item.id}`} className="rounded-xl border border-slate-200 bg-amber-50/50 p-4 space-y-3">
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
                  <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => handleDeviceAction(item.id, "approve-device")}>
                    Approve New Device
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeviceAction(item.id, "deregister-device")}>
                    De-register Device
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registered devices */}
      {activeDevices.length > 0 && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Registered Devices</h2>
            <p className="text-xs text-slate-500">De-register when an employee changes their phone or device.</p>
          </div>
          <div className="space-y-2">
            {activeDevices.map((item) => (
              <div key={`ad-${item.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium text-slate-900">{item.name} ({item.mobile || "-"})</p>
                  <p className="text-slate-700 break-all">Device: {item.approvedDeviceId}</p>
                  <p className="text-slate-600 break-all">IP: {item.approvedDeviceIp || "-"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleDeviceAction(item.id, "deregister-device")}>
                  De-register Device
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { parseAddress } from "@/lib/address-utils"
import { notify } from "@/components/ui/notify"
import { GARAGE_DEPARTMENTS, getDesignationsForDepartment } from "@/lib/garage-departments"
import { AdminLeaveRequestsPanel } from "@/components/dashboard/admin-leave-requests-panel"
import { SwitchCamera, Camera } from "lucide-react"

// ── Admin face capture overlay ────────────────────────────────────────────────

function AdminFaceCaptureOverlay({
  onCapture,
  onCancel,
}: {
  onCapture: (blob: Blob) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<"user" | "environment">("user")
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const circleR  = viewport.w > 0 ? Math.min(Math.floor(viewport.w * 0.40), 155) : 140
  const circleCX = viewport.w > 0 ? Math.round(viewport.w / 2) : 190
  const circleCY = viewport.h > 0 ? Math.round(viewport.h * 0.40) : 300
  const videoClip = viewport.w > 0 ? `circle(${circleR}px at ${circleCX}px ${circleCY}px)` : undefined

  const startStream = useCallback(async (facingMode: "user" | "environment") => {
    setReady(false)
    setError("")
    streamRef.current?.getTracks().forEach((t) => t.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setReady(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera access denied")
    }
  }, [])

  useEffect(() => {
    void startStream(facing)
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const handleSwitch = async () => {
    const next = facing === "user" ? "environment" : "user"
    setFacing(next)
    await startStream(next)
  }

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext("2d")!
    // Mirror for front camera
    if (facing === "user") {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        onCapture(blob)
      }
    }, "image/jpeg", 0.92)
  }

  const statusY = circleCY + circleR + 28

  return (
    <div className="fixed inset-0 z-[60]" style={{ background: "rgb(232,230,224)" }}>
      {/* Camera feed clipped to circle */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          clipPath: videoClip,
          transform: facing === "user" ? "scaleX(-1)" : "none",
        }}
        playsInline
        muted
        autoPlay
      />

      {/* Border ring + glow */}
      {viewport.w > 0 && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 10 }}
        >
          <circle cx={circleCX} cy={circleCY} r={circleR + 6} fill="none" stroke="rgba(34,197,94,0.20)" strokeWidth={14} />
          <circle cx={circleCX} cy={circleCY} r={circleR} fill="none" stroke="#22c55e" strokeWidth={3.5} />
        </svg>
      )}

      {/* Status / hint */}
      {viewport.w > 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl border bg-emerald-50 border-emerald-300 text-emerald-700 text-sm font-medium text-center w-[82%] max-w-sm"
          style={{ top: statusY, zIndex: 20 }}
        >
          {error ? error : ready ? "Position face inside the circle and capture" : "Starting camera…"}
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-4 left-0 right-0 px-4 flex items-center justify-between z-20">
        <Button variant="outline" className="bg-white border-slate-300 text-slate-700 shadow-sm" onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); onCancel() }}>
          Cancel
        </Button>
        <Button variant="outline" className="bg-white border-slate-300 text-slate-700 shadow-sm gap-2" onClick={handleSwitch}>
          <SwitchCamera className="h-4 w-4" />
          {facing === "user" ? "Rear" : "Front"}
        </Button>
      </div>

      {/* Capture button */}
      {ready && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
          <button
            type="button"
            onClick={handleCapture}
            className="h-16 w-16 rounded-full bg-white border-4 border-emerald-500 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <Camera className="h-7 w-7 text-emerald-600" />
          </button>
        </div>
      )}
    </div>
  )
}

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
  department: string
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
  department: "",
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
  hideLeavePanel?: boolean
}

export function ApprovalsModule({ filterUserId, filterMobile, hideLeavePanel = false }: ApprovalsModuleProps = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [requests, setRequests] = useState<PendingUser[]>([])
  const [deviceRequests, setDeviceRequests] = useState<DeviceRequestUser[]>([])
  const [activeDevices, setActiveDevices] = useState<DeviceRequestUser[]>([])
  const [profiles, setProfiles] = useState<Record<string, ApprovalProfile>>({})
  const [captureTarget, setCaptureTarget] = useState<{ userId: string; name: string } | null>(null)

  const updateProfile = (userId: string, patch: Partial<ApprovalProfile>) => {
    setProfiles((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] || createEmptyProfile()), ...patch },
    }))
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

  const handleCapturePhoto = async (blob: Blob) => {
    if (!captureTarget) return
    const { userId, name } = captureTarget
    setCaptureTarget(null)
    const file = new File([blob], `${name || "employee"}-${Date.now()}.jpg`, { type: "image/jpeg" })
    try {
      await uploadEmployeePhoto(userId, name, file)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to save captured photo")
    }
  }

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
            department: "",
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
      if (!profile.department) { notify.error("Please select a department before approval."); return }
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
    <>
    {captureTarget && (
      <AdminFaceCaptureOverlay
        onCapture={handleCapturePhoto}
        onCancel={() => setCaptureTarget(null)}
      />
    )}
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

                      {/* Role */}
                      <div className="space-y-1">
                        <Label htmlFor={`access-role-${item.id}`} className="text-xs">Role <span className="text-red-500">*</span></Label>
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

                      {/* Department */}
                      <div className="space-y-1">
                        <Label htmlFor={`department-${item.id}`} className="text-xs">Department <span className="text-red-500">*</span></Label>
                        <select
                          id={`department-${item.id}`}
                          value={profile.department}
                          onChange={(e) => updateProfile(item.id, { department: e.target.value, designation: "" })}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select Department</option>
                          {GARAGE_DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      {/* Designation — filtered by department */}
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor={`designation-${item.id}`} className="text-xs">Designation <span className="text-red-500">*</span></Label>
                        <select
                          id={`designation-${item.id}`}
                          value={profile.designation}
                          onChange={(e) => updateProfile(item.id, { designation: e.target.value })}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">
                            {profile.department ? "Select Designation" : "Select a department first"}
                          </option>
                          {getDesignationsForDepartment(profile.department).map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      {/* Photo capture */}
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs">Employee Photo (Mandatory — Live Capture Only)</Label>
                        <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="h-24 w-20 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100 relative">
                            <Image
                              src={profile.facePhotoUrl || "/dummy-profile.svg"}
                              alt={`${item.name} photo preview`}
                              fill
                              className={profile.facePhotoUrl ? "object-cover" : "object-contain p-3"}
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => setCaptureTarget({ userId: item.id, name: item.name })}
                          >
                            <Camera className="h-4 w-4" />
                            {profile.facePhotoUrl ? "Retake Photo" : "Take Live Photo"}
                          </Button>
                        </div>
                      </div>

                    </div>

                    <div className={requests.length === 1 ? "flex items-center justify-end gap-2 mt-0" : "flex items-center justify-end gap-2 mt-8"}>
                      <Button
                        size="sm"
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => handleAction(item.id, "approve")}
                        disabled={!profile.accessRole || !profile.department || !profile.designation || !profile.facePhotoUrl}
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

      {!hideLeavePanel && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Leave Management</h2>
            <p className="text-xs text-slate-500">Approve or reject leave requests submitted by employees.</p>
          </div>
          <AdminLeaveRequestsPanel />
        </div>
      )}
    </div>
    </>
  )
}

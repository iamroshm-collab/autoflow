"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { notify } from "@/components/ui/notify"
import { normalizeMobileNumber } from "@/lib/mobile-validation"

type BootstrapResult = {
  success?: boolean
  action?: "created" | "updated"
  error?: string
}

type BootstrapStatus = {
  adminBootstrap?: {
    enabledByEnv: boolean
    productionBlocked: boolean
    locked: boolean
    lockedByRuntime: boolean
    lockedByFile: boolean
    hasSetupKey: boolean
    effectiveEnabled: boolean
  }
}

export default function AdminBootstrapPage() {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [mobile, setMobile] = useState("")
  const [setupKey, setSetupKey] = useState("")
  const [result, setResult] = useState<BootstrapResult | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [lockLoading, setLockLoading] = useState(false)
  const [status, setStatus] = useState<BootstrapStatus["adminBootstrap"] | null>(null)

  const loadStatus = async () => {
    setStatusLoading(true)
    try {
      const response = await fetch("/api/auth/bootstrap-admin/status", { cache: "no-store" })
      const data = (await response.json()) as BootstrapStatus
      if (!response.ok) {
        notify.error("Failed to load bootstrap status")
        return
      }
      setStatus(data.adminBootstrap || null)
    } catch {
      notify.error("Failed to load bootstrap status")
    } finally {
      setStatusLoading(false)
    }
  }

  const lockBootstrap = async () => {
    if (!setupKey.trim()) {
      notify.error("Setup Key is required to lock bootstrap")
      return
    }

    setLockLoading(true)
    try {
      const response = await fetch("/api/auth/bootstrap-admin/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupKey }),
      })
      const data = await response.json()
      if (!response.ok) {
        notify.error(data.error || "Failed to lock bootstrap")
        return
      }

      notify.success("Bootstrap is now locked")
      await loadStatus()
    } catch {
      notify.error("Failed to lock bootstrap")
    } finally {
      setLockLoading(false)
    }
  }

  const submit = async () => {
    const fields = [
      { label: "Full Name", value: name },
      { label: "Mobile", value: mobile },
      { label: "Setup Key", value: setupKey },
    ]

    const missing = fields.find((field) => !String(field.value || "").trim())
    if (missing) {
      notify.error(`${missing.label} is required`)
      return
    }

    if (normalizeMobileNumber(mobile).length !== 10) {
      notify.error("Mobile must be exactly 10 digits")
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/auth/bootstrap-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mobile: normalizeMobileNumber(mobile),
          setupKey,
        }),
      })

      const data = (await response.json()) as BootstrapResult
      if (!response.ok) {
        setResult({ success: false, error: data.error || "Bootstrap failed" })
        notify.error(data.error || "Bootstrap failed")
        return
      }

      setResult(data)
      notify.success(data.action === "updated" ? "Admin account updated" : "Admin account created")
    } catch {
      setResult({ success: false, error: "Something went wrong. Please try again." })
      notify.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Admin Bootstrap</h1>
          <p className="text-sm text-slate-500">
            Developer-only setup screen. Use once to create or promote an admin account.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            value={mobile}
            onChange={(e) => setMobile(normalizeMobileNumber(e.target.value))}
            inputMode="numeric"
            maxLength={10}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="setup-key">Setup Key</Label>
          <Input id="setup-key" type="password" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} />
        </div>

        <Button type="button" onClick={submit} disabled={loading} className="w-full">
          {loading ? "Applying..." : "Create or Update Admin"}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={loadStatus} disabled={statusLoading}>
            {statusLoading ? "Checking..." : "Check Status"}
          </Button>
          <Button type="button" variant="destructive" onClick={lockBootstrap} disabled={lockLoading}>
            {lockLoading ? "Locking..." : "Lock Bootstrap"}
          </Button>
        </div>

        {status ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
            <p>Enabled by env: {String(status.enabledByEnv)}</p>
            <p>Production blocked: {String(status.productionBlocked)}</p>
            <p>Locked: {String(status.locked)}</p>
            <p>Has setup key: {String(status.hasSetupKey)}</p>
            <p>Effective enabled: {String(status.effectiveEnabled)}</p>
          </div>
        ) : null}

        {result?.error ? <p className="text-sm text-rose-600">{result.error}</p> : null}
        {result?.success ? (
          <p className="text-sm text-emerald-600">
            Admin bootstrap successful ({result.action || "updated"}). You can now login from the normal login page.
          </p>
        ) : null}

        <p className="text-xs text-slate-500">
          After setup, lock bootstrap here and then set ADMIN_BOOTSTRAP_ENABLED=false in environment.
        </p>
      </div>
    </main>
  )
}
"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/notify"

export default function VerifyEditDialog({ employeeId, open, onOpenChange, onVerified }: { employeeId: number, open: boolean, onOpenChange: (v: boolean) => void, onVerified: (token: string, imageUrl?: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [similarity, setSimilarity] = useState<number | null>(null)

  const runVerify = async () => {
    console.log('[VerifyDialog] employeeId:', employeeId, 'Type:', typeof employeeId)
    if (!employeeId || employeeId <= 0) {
      console.log('[VerifyDialog] Early return: invalid employeeId')
      toast.error("No employee selected for verification")
      return
    }

    setLoading(true)
    const url = `/api/attendance-payroll/corrections/verify/${employeeId}`
    console.log('[VerifyDialog] Calling URL:', url)
    try {
      const res = await fetch(url, { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.verified) {
        toast.error(data.message || "Verification failed")
        return
      }
      setImageUrl(data.imagePublicUrl || null)
      setSimilarity(data.similarity ?? null)
      onVerified(data.token, data.imagePublicUrl)
      toast.success("Verification succeeded — token issued")
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error("Verification failed")
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify & Issue Token</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm">This will run the multi-frame verifier and issue a single-use correction token if successful.</div>
          {imageUrl && (
            <div>
              <img src={imageUrl} alt="verification" className="max-w-xs rounded border" />
              <div className="text-sm text-gray-600">Similarity: {similarity}</div>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={runVerify} disabled={loading}>{loading ? "Verifying..." : "Run Verification"}</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

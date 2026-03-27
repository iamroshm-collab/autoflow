"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-950">Password Reset Removed</h1>
          <p className="text-sm text-slate-500">Use mobile number + WhatsApp OTP login. Password reset links are no longer used.</p>
        </div>

        <Button type="button" asChild className="w-full">
          <Link href="/login">Go to Login</Link>
        </Button>

        <p className="text-sm text-slate-500">
          <Link href="/login" className="text-sky-700 hover:text-sky-800">Return to login</Link>
        </p>
      </div>
    </main>
  )
}
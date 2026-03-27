"use client"

import Link from "next/link"

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-950">Password Reset Disabled</h1>
          <p className="text-sm text-slate-500">Email-password login is removed. Use your mobile number and WhatsApp OTP on login screen.</p>
        </div>

        <p className="text-sm text-slate-500">
          <Link href="/login" className="text-sky-700 hover:text-sky-800">Back to login</Link>
        </p>
      </div>
    </main>
  )
}
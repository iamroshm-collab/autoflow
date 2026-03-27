"use client"

import Link from "next/link"

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-4 text-center">
        <div className="text-3xl">i</div>
        <h1 className="text-lg font-semibold text-slate-900">Email Verification Removed</h1>
        <p className="text-sm text-slate-500">This app now uses mobile number and WhatsApp OTP verification.</p>
        <Link href="/login" className="text-sm text-blue-600 underline">
          Go to Login
        </Link>
      </div>
    </main>
  )
}


"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** /admin-login is no longer a separate page — all logins go through /login. */
export default function AdminLoginRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/login")
  }, [router])
  return null
}

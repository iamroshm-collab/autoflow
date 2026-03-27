"use client"

import { useEffect } from "react"
import { initOneSignal, requestPushPermissionAndRegister } from "@/lib/onesignal-web"

type CurrentUserResponse = {
  user?: {
    employeeRefId?: number | null
  }
}

export default function OneSignalProvider() {
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const oneSignal = await initOneSignal()
        if (!oneSignal || cancelled) {
          return
        }

        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        })

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as CurrentUserResponse
        const employeeId = Number(data?.user?.employeeRefId)
        if (!Number.isInteger(employeeId) || cancelled) {
          return
        }

        await requestPushPermissionAndRegister(employeeId)
      } catch (error) {
        console.warn("[ONESIGNAL_PROVIDER]", error)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
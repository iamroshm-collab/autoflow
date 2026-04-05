"use client"

import { useEffect, useState } from "react"
import { notify } from "@/components/ui/notify"

export interface AttendanceEmployee {
  employeeId: number
  empName: string
  mobile: string
  designation: string | null
  facePhotoUrl: string | null
}

export interface AttendanceDetails {
  employee: AttendanceEmployee
  nextAction: "IN" | "OUT"
  todayRecord: {
    attendance: string
    checkInAt: string | null
    checkOutAt: string | null
    workedDuration: string
  } | null
}

export const useAttendanceDetails = () => {
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number | null>(null)
  const [details, setDetails] = useState<AttendanceDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const loadCurrentEmployee = async () => {
      try {
        const meResponse = await fetch("/api/auth/me", { cache: "no-store" })
        const meData = await meResponse.json()
        if (!meResponse.ok) {
          throw new Error(meData.error || "Please login to continue")
        }

        const employeeRefId = Number(meData?.user?.employeeRefId)
        if (!Number.isInteger(employeeRefId)) {
          throw new Error("Your account is not mapped to an employee profile")
        }

        setCurrentEmployeeId(employeeRefId)

        const response = await fetch(`/api/mobile-attendance?employeeId=${employeeRefId}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to load attendance details")
        }
        setDetails(data)
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "Failed to load attendance details")
      }
    }

    void loadCurrentEmployee()
  }, [])

  useEffect(() => {
    if (!Number.isInteger(currentEmployeeId)) return

    const loadDetails = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/mobile-attendance?employeeId=${currentEmployeeId}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to load attendance details")
        }
        setDetails(data)
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "Failed to load attendance details")
        setDetails(null)
      } finally {
        setIsLoading(false)
      }
    }

    void loadDetails()
  }, [currentEmployeeId])

  const refreshDetails = async () => {
    if (!currentEmployeeId) return

    const refreshed = await fetch(`/api/mobile-attendance?employeeId=${currentEmployeeId}`)
    const refreshedData = await refreshed.json()
    if (refreshed.ok) {
      setDetails(refreshedData)
    }
  }

  return { details, isLoading, refreshDetails }
}

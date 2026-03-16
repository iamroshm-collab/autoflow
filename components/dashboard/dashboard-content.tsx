"use client"

import { memo, useEffect, useState } from "react"

import { MetricCards } from "./metric-cards"
import { ServiceOverviewChart } from "./service-overview-chart"
import { JobCardStatusChart } from "./job-card-status-chart"
import { RecentJobCards } from "./recent-job-cards"

type DashboardSummary = {
  metrics: {
    totalJobCards: number
    todayService: number
    pendingBilling: number
    totalCustomers: number
  }
  serviceOverview: Array<{ month: string; services: number }>
  statusBreakdown: Array<{ name: "Completed" | "In Progress" | "Pending" | "Cancelled"; value: number }>
  recentJobCards: Array<{
    id: string
    customer: string
    vehicle: string
    date: string
    status: "Completed" | "In Progress" | "Pending" | "Cancelled"
  }>
}

const EMPTY_SUMMARY: DashboardSummary = {
  metrics: {
    totalJobCards: 0,
    todayService: 0,
    pendingBilling: 0,
    totalCustomers: 0,
  },
  serviceOverview: [],
  statusBreakdown: [],
  recentJobCards: [],
}

interface DashboardContentProps {
  onNavigate?: (id: string) => void
}

export const DashboardContent = memo(function DashboardContent({ onNavigate }: DashboardContentProps) {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY)

  useEffect(() => {
    let isMounted = true

    const loadSummary = async () => {
      try {
        const response = await fetch("/api/dashboard/summary", { cache: "no-store" })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch dashboard summary")
        }

        if (isMounted) {
          setSummary({
            metrics: data.metrics || EMPTY_SUMMARY.metrics,
            serviceOverview: Array.isArray(data.serviceOverview) ? data.serviceOverview : [],
            statusBreakdown: Array.isArray(data.statusBreakdown) ? data.statusBreakdown : [],
            recentJobCards: Array.isArray(data.recentJobCards) ? data.recentJobCards : [],
          })
        }
      } catch (error) {
        console.error("[DASHBOARD_SUMMARY_FETCH]", error)
      }
    }

    loadSummary()

    const onFocus = () => {
      loadSummary()
    }

    window.addEventListener("focus", onFocus)

    return () => {
      isMounted = false
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <MetricCards metrics={summary.metrics} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ServiceOverviewChart data={summary.serviceOverview} />
        </div>
        <div>
          <JobCardStatusChart data={summary.statusBreakdown} />
        </div>
      </div>
      <div>
        <RecentJobCards jobs={summary.recentJobCards} />
      </div>
    </div>
  )
})

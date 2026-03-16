"use client"

import { memo, useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type RecentJob = {
  jobCardNumber: string
  fileNo?: string | null
  total?: number | null
  advancePayment?: number | null
  externalShop?: boolean
  externalShopRemarks?: string | null
  customer?: {
    name?: string | null
    mobileNo?: string | null
  } | null
  vehicle?: {
    registrationNumber?: string | null
  } | null
}

interface RecentJobCardsProps {
  jobs?: unknown[]
}

const externalShopStyles: Record<"Yes" | "No", string> = {
  Yes: "bg-emerald-500 text-white border-emerald-500",
  No: "bg-rose-500 text-white border-rose-500",
}

export const RecentJobCards = memo(function RecentJobCards({ jobs }: RecentJobCardsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allUnderServiceJobs, setAllUnderServiceJobs] = useState<RecentJob[]>([])

  useEffect(() => {
    let isMounted = true

    const loadUnderServiceJobs = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/jobcards/under-service", { cache: "no-store" })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || "Failed to fetch under-service job cards")
        }

        if (isMounted) {
          setAllUnderServiceJobs(Array.isArray(data) ? data : [])
        }
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load job cards")
          setAllUnderServiceJobs([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadUnderServiceJobs()

    return () => {
      isMounted = false
    }
  }, [jobs])

  const formatCurrency = (value?: number | null) => {
    const amount = Number(value || 0)
    return `Rs ${amount.toFixed(2)}`
  }

  const renderTable = (rows: RecentJob[]) => {
    if (loading) {
      return (
        <tr>
          <td colSpan={8} className="py-6 px-2 text-center text-sm text-muted-foreground">
            Loading...
          </td>
        </tr>
      )
    }

    if (error) {
      return (
        <tr>
          <td colSpan={8} className="py-6 px-2 text-center text-sm text-red-600">
            Error: {error}
          </td>
        </tr>
      )
    }

    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={8} className="py-6 px-2 text-center text-sm text-muted-foreground">
            No under-service job cards found.
          </td>
        </tr>
      )
    }

    return rows.map((job) => {
      const externalShopValue: "Yes" | "No" = job.externalShop ? "Yes" : "No"

      return (
        <tr
          key={job.jobCardNumber}
          className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
        >
          <td className="py-3 px-2 text-card-foreground">
            {job.vehicle?.registrationNumber || "-"}
          </td>
          <td className="py-3 px-2 text-card-foreground">{job.customer?.name || "-"}</td>
          <td className="py-3 px-2 text-card-foreground">{job.customer?.mobileNo || "-"}</td>
          <td className="py-3 px-2 text-card-foreground">{job.fileNo || "-"}</td>
          <td className="py-3 px-2 text-card-foreground">{formatCurrency(job.total)}</td>
          <td className="py-3 px-2 text-card-foreground">{formatCurrency(job.advancePayment)}</td>
          <td className="py-3 px-2">
            <span
              className={cn(
                "inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full border",
                externalShopStyles[externalShopValue]
              )}
            >
              {externalShopValue}
            </span>
          </td>
          <td className="py-3 px-2 text-card-foreground">{job.externalShopRemarks || "-"}</td>
        </tr>
      )
    })
  }

  return (
    <>
      <div className="flex flex-col p-5 bg-card text-card-foreground rounded-xl shadow-sm border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-semibold text-card-foreground">
            Recent Job Cards
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Customer Name</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Customer Mobile</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">File No</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Total Bill</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Advance</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">External Shop</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">External Shop Remarks</th>
              </tr>
            </thead>
            <tbody>{renderTable(allUnderServiceJobs)}</tbody>
          </table>
        </div>
      </div>
    </>
  )
})

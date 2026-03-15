"use client"

import { memo } from "react"

import { ChevronRight, UserCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type JobStatus = "Completed" | "In Progress" | "Pending" | "Cancelled"

type RecentJob = {
  id: string
  customer: string
  vehicle: string
  date: string
  status: JobStatus
}

interface RecentJobCardsProps {
  jobs?: RecentJob[]
}

const statusStyles: Record<JobStatus, string> = {
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
}

export const RecentJobCards = memo(function RecentJobCards({ jobs }: RecentJobCardsProps) {
  const tableRows = Array.isArray(jobs) ? jobs : []

  return (
    <div className="flex flex-col p-5 bg-card text-card-foreground rounded-xl shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-semibold text-card-foreground">
          Recent Job Cards
        </h3>
        <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Job Card ID</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Customer</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Vehicle</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Service Date</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 px-2 text-center text-sm text-muted-foreground">
                  No recent job cards found.
                </td>
              </tr>
            ) : (
              tableRows.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-2 font-medium text-card-foreground">{job.id}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <UserCircle className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="text-card-foreground">{job.customer}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground font-mono text-xs">
                    {job.vehicle}
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{job.date}</td>
                  <td className="py-3 px-2">
                    <span
                      className={cn(
                        "inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full border",
                        statusStyles[job.status]
                      )}
                    >
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
})

"use client"

import { memo, useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"

type ExternalShopJob = {
  id: string
  jobCardNumber: string
  customerName: string
  mobileNo: string
  vehicleReg: string
  vehicleMake: string
  vehicleModel: string
  remarks: string
}

interface ExternalShopJobsProps {
  jobs?: ExternalShopJob[]
}

export const ExternalShopJobs = memo(function ExternalShopJobs({ jobs }: ExternalShopJobsProps) {
  const [loading, setLoading] = useState(true)
  const [jobsList, setJobsList] = useState<ExternalShopJob[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchExternalShopJobs = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/api/jobcards/external-shop", { cache: "no-store" })
        
        // Check response status first
        if (!response.ok) {
          let errorMessage = "Failed to fetch external shop jobs"
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
            if (errorData.details) {
              errorMessage += `: ${errorData.details}`
            }
          } catch (e) {
            // If response is not JSON, use HTTP status text
            errorMessage = `${response.status} ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        // Now parse successful response
        const data = await response.json()
        setJobsList(Array.isArray(data) ? data : [])
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error("[EXTERNAL_SHOP_JOBS_FETCH]", errorMsg, error)
        setError(errorMsg)
        setJobsList([])
      } finally {
        setLoading(false)
      }
    }

    if (!jobs) {
      fetchExternalShopJobs()
    } else {
      setJobsList(jobs)
      setLoading(false)
    }
  }, [jobs])

  const tableRows = jobsList.length > 0 ? jobsList : []

  return (
    <div className="flex flex-col p-5 bg-card text-card-foreground rounded-xl shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-semibold text-card-foreground">
          External Shop Jobs
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
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Job Card #</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Customer</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Mobile</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Vehicle</th>
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-6 px-2 text-center text-sm text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="py-6 px-2 text-center text-sm text-red-600">
                  Error: {error}
                </td>
              </tr>
            ) : tableRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 px-2 text-center text-sm text-muted-foreground">
                  No external shop jobs found.
                </td>
              </tr>
            ) : (
              tableRows.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-2 font-medium text-card-foreground">{job.jobCardNumber}</td>
                  <td className="py-3 px-2 text-card-foreground">{job.customerName}</td>
                  <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{job.mobileNo}</td>
                  <td className="py-3 px-2 text-muted-foreground">
                    {job.vehicleReg} · {job.vehicleMake} {job.vehicleModel}
                  </td>
                  <td className="py-3 px-2 text-muted-foreground text-xs">{job.remarks || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
})

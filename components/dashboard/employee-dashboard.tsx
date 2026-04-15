"use client"

import { memo, useEffect, useState } from "react"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import { CheckCircle2, Clock, Car, Timer, Wrench, Star, MoreHorizontal } from "lucide-react"

interface EmployeeMetrics {
  totalDone: number
  todayDone: number
  todayPending: number
  uniqueVehicles: number
  turnaroundLabel: string
  avgMinutes: number | null
}

interface MonthlyPoint {
  month: string
  jobs: number
}

interface EmployeeSummary {
  metrics: EmployeeMetrics
  monthlyOverview: MonthlyPoint[]
}

const EMPTY: EmployeeSummary = {
  metrics: {
    totalDone: 0,
    todayDone: 0,
    todayPending: 0,
    uniqueVehicles: 0,
    turnaroundLabel: "—",
    avgMinutes: null,
  },
  monthlyOverview: [],
}

interface EmployeeDashboardProps {
  employeeId: number | null
}

export const EmployeeDashboard = memo(function EmployeeDashboard({ employeeId }: EmployeeDashboardProps) {
  const [summary, setSummary] = useState<EmployeeSummary>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employeeId) return

    let mounted = true

    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/dashboard/employee-summary?employeeId=${employeeId}`, {
          cache: "no-store",
        })
        if (!res.ok) return
        const data = await res.json()
        if (mounted) {
          setSummary({
            metrics: data.metrics ?? EMPTY.metrics,
            monthlyOverview: Array.isArray(data.monthlyOverview) ? data.monthlyOverview : [],
          })
        }
      } catch (err) {
        console.error("[EMPLOYEE_DASHBOARD]", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    const onFocus = () => load()
    window.addEventListener("focus", onFocus)

    return () => {
      mounted = false
      window.removeEventListener("focus", onFocus)
    }
  }, [employeeId])

  const { metrics, monthlyOverview } = summary

  const statCards = [
    {
      label: "Total Jobs Done",
      value: metrics.totalDone.toLocaleString("en-IN"),
      icon: CheckCircle2,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    {
      label: "Today Completed",
      value: metrics.todayDone.toLocaleString("en-IN"),
      icon: Wrench,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      label: "Today Pending",
      value: metrics.todayPending.toLocaleString("en-IN"),
      icon: Clock,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      label: "Vehicles Attended",
      value: metrics.uniqueVehicles.toLocaleString("en-IN"),
      icon: Car,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      label: "Avg. Turnaround",
      value: metrics.turnaroundLabel,
      icon: Timer,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
    },
  ]

  return (
    <div className="flex flex-col gap-[1mm] pb-[1mm] overflow-y-auto h-full">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-[1mm] sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="dashboard-card flex items-center gap-4 hover:shadow-md transition-shadow"
          >
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 ${card.iconBg}`}
            >
              <card.icon className={`w-6 h-6 ${card.iconColor}`} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm text-muted-foreground leading-tight">{card.label}</span>
              <span className={`font-heading font-bold text-card-foreground leading-tight ${card.value.length > 5 ? "text-xl" : "text-2xl"}`}>
                {loading ? (
                  <span className="inline-block w-12 h-6 bg-muted rounded animate-pulse" />
                ) : (
                  card.value
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Chart */}
      <div className="dashboard-card flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-semibold text-card-foreground">
            Monthly Job Activity
          </h3>
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Favorite"
            >
              <Star className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={monthlyOverview}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="empJobGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                axisLine={{ stroke: "hsl(214, 32%, 91%)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                axisLine={{ stroke: "hsl(214, 32%, 91%)" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(214, 32%, 91%)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
                formatter={(value: number) => [value, "Jobs Completed"]}
              />
              <Area
                type="monotone"
                dataKey="jobs"
                isAnimationActive={false}
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2.5}
                fill="url(#empJobGradient)"
                dot={{ r: 4, fill: "hsl(217, 91%, 60%)", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, fill: "hsl(217, 91%, 60%)", strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
})

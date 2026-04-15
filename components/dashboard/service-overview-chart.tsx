"use client"

import { memo } from "react"
import type React from "react"

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import { Star, MoreHorizontal } from "lucide-react"

const fallbackData: Array<{ month: string; services: number }> = []

interface ServiceOverviewChartProps {
  data?: Array<{ month: string; services: number }>
  title?: string
  valueLabel?: string
  headerSlot?: React.ReactNode
}

export const ServiceOverviewChart = memo(function ServiceOverviewChart({ data, title, valueLabel, headerSlot }: ServiceOverviewChartProps) {
  const chartData = data && data.length > 0 ? data : fallbackData

  return (
    <div className="dashboard-card flex h-full flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-semibold text-card-foreground">
          {title ?? "Service Overview"}
        </h3>
        {headerSlot ?? (
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="Favorite">
              <Star className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="More options">
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="serviceGradient" x1="0" y1="0" x2="0" y2="1">
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
            />
            <Area
              type="monotone"
              dataKey="services"
              isAnimationActive={false}
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2.5}
              fill="url(#serviceGradient)"
              dot={{ r: 4, fill: "hsl(217, 91%, 60%)", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6, fill: "hsl(217, 91%, 60%)", strokeWidth: 2, stroke: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
})

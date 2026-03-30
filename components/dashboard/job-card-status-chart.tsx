"use client"

import { memo } from "react"

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"

type StatusItem = {
  name: "Completed" | "In Progress" | "Pending" | "Cancelled"
  value: number
}

const fallbackData: StatusItem[] = [
  { name: "Completed", value: 0 },
  { name: "In Progress", value: 0 },
  { name: "Pending", value: 0 },
  { name: "Cancelled", value: 0 },
]

const colorMap: Record<StatusItem["name"], string> = {
  Completed: "#22c55e",
  "In Progress": "#3b82f6",
  Pending: "#f59e0b",
  Cancelled: "#ef4444",
}

interface JobCardStatusChartProps {
  data?: StatusItem[]
}

export const JobCardStatusChart = memo(function JobCardStatusChart({ data }: JobCardStatusChartProps) {
  const chartData = data && data.length > 0 ? data : fallbackData
  const total = chartData.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="dashboard-card flex h-full flex-col">
      <h3 className="text-lg font-heading font-semibold text-card-foreground mb-4">
        Job Card Status
      </h3>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-44 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                isAnimationActive={false}
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colorMap[entry.name]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-heading font-bold text-card-foreground">
              {total.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 w-full">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colorMap[item.name] }}
                />
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
              <span className="text-sm font-semibold text-card-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

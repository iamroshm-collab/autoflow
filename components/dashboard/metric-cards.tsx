"use client"

import { memo } from "react"

import { ClipboardList, Wrench, IndianRupee, Users } from "lucide-react"

interface MetricCardsProps {
  metrics?: {
    totalJobCards: number
    todayService: number
    pendingBilling: number
    totalCustomers: number
  }
}

const formatNumber = (value: number) => value.toLocaleString("en-IN")

const formatCurrency = (value: number) =>
  `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

export const MetricCards = memo(
  function MetricCards({ metrics }: MetricCardsProps) {
  const cards = [
  {
    label: "Total Job Cards",
    value: formatNumber(metrics?.totalJobCards || 0),
    icon: ClipboardList,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    label: "Today's Service",
    value: formatNumber(metrics?.todayService || 0),
    icon: Wrench,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    label: "Pending Billing",
    value: formatCurrency(metrics?.pendingBilling || 0),
    icon: IndianRupee,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    label: "Total Customers",
    value: formatNumber(metrics?.totalCustomers || 0),
    icon: Users,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((metric) => (
        <div
          key={metric.label}
          className="flex items-center gap-4 p-5 bg-card text-card-foreground rounded-xl shadow-sm border border-border/50 hover:shadow-md transition-shadow"
        >
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-xl ${metric.iconBg}`}
          >
            <metric.icon className={`w-6 h-6 ${metric.iconColor}`} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">{metric.label}</span>
            <span className="text-2xl font-heading font-bold text-card-foreground">
              {metric.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
  },
  (prevProps: MetricCardsProps, nextProps: MetricCardsProps) => {
    const p = prevProps.metrics ?? {
      totalJobCards: 0,
      todayService: 0,
      pendingBilling: 0,
      totalCustomers: 0,
    }
    const n = nextProps.metrics ?? {
      totalJobCards: 0,
      todayService: 0,
      pendingBilling: 0,
      totalCustomers: 0,
    }

    return (
      p.totalJobCards === n.totalJobCards &&
      p.todayService === n.todayService &&
      p.pendingBilling === n.pendingBilling &&
      p.totalCustomers === n.totalCustomers
    )
  }
)

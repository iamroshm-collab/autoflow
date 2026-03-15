"use client"

import { Plus, Wrench, UserPlus, Receipt } from "lucide-react"

const actions = [
  {
    id: "new-job-card",
    label: "New Job Card",
    icon: Plus,
    bg: "bg-blue-600 hover:bg-blue-700",
    text: "text-white",
  },
  {
    id: "update-job-card",
    label: "Under Service",
    icon: Wrench,
    bg: "bg-emerald-600 hover:bg-emerald-700",
    text: "text-white",
  },
  {
    id: "customers",
    label: "Add Customer",
    icon: UserPlus,
    bg: "bg-violet-600 hover:bg-violet-700",
    text: "text-white",
  },
  {
    id: "income-expense",
    label: "Billing",
    icon: Receipt,
    bg: "bg-amber-500 hover:bg-amber-600",
    text: "text-white",
  },
]

interface QuickActionsProps {
  onNavigate?: (id: string) => void
}

export function QuickActions({ onNavigate }: QuickActionsProps) {
  return (
    <div className="flex flex-col p-5 bg-card text-card-foreground rounded-xl shadow-sm border border-border/50">
      <h3 className="text-lg font-heading font-semibold text-card-foreground mb-4">
        Quick Actions
      </h3>
      <div className="flex flex-col gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => onNavigate?.(action.id)}
            className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${action.bg} ${action.text}`}
          >
            <action.icon className="w-4 h-4" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  ClipboardList,
  FilePlus,
  Wrench,
  ClipboardCheck,
  Truck,
  User,
  Users,
  CalendarCheck,
  Package,
  ShoppingCart,
  UserCircle,
  TrendingUpDown,
  Cog,
  ChevronDown,
  ChevronRight,
  Settings,
} from "lucide-react"

export type MenuItem = {
  id: string
  label: string
  icon: React.ElementType
  subMenu?: { id: string; label: string; icon: React.ElementType }[]
}

export const menuItems: MenuItem[] = [
  { id: "new-job-card", label: "New Job Card", icon: FilePlus },
  { id: "update-job-card", label: "Under Service", icon: Wrench },
  { id: "technician-task-details", label: "Technician Tasks", icon: ClipboardCheck },
  { id: "delivered", label: "Ready for Delivery", icon: Truck },
  { id: "maintenance-tracker", label: "Maintenance Tracker", icon: Package },
  { id: "employee", label: "Employee", icon: User },
  { id: "attendance-payroll", label: "Attendance & Payroll", icon: CalendarCheck },
  { id: "inventory", label: "Suppliers & Products", icon: Users },
  { id: "inventory-pos", label: "Inventory POS", icon: ShoppingCart },
  { id: "customers", label: "Customers", icon: UserCircle },
  { id: "income-expense", label: "Income - Expense", icon: TrendingUpDown },
  { id: "spare-parts", label: "Spare Parts", icon: Cog },
]

interface SidebarProps {
  activeItem: string
  onSelect: (id: string) => void
}

export function Sidebar({ activeItem, onSelect }: SidebarProps) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  const toggleExpanded = (id: string) => {
    setExpandedMenus((prev) =>
      prev.includes(id) ? [] : [id]
    )
  }

  const handleMenuSelect = (id: string) => {
    onSelect(id)
    setExpandedMenus([])
  }

  const isActive = (id: string) => activeItem === id

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gradient-to-b from-[#000F48] to-[#8D1730] text-sidebar-foreground">
      {/* Logo Section with aligned divider */}
      <div className="h-14 flex items-center gap-3 px-5">
        <img src="/autoflow-logo.svg" alt="AutoFlow" className="h-[1.7rem] w-auto" />
        <span className="sr-only">AutoFlow</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {/* Dashboard Item */}
          <li>
            <button
              onClick={() => handleMenuSelect("dashboard")}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive("dashboard")
                  ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25"
                  : "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
              )}
            >
              <ClipboardList className="w-5 h-5 shrink-0" />
              <span>Dashboard</span>
            </button>
          </li>

          {menuItems.map((item) => (
            <li key={item.id}>
              {item.subMenu ? (
                <div>
                  <button
                    onClick={() => {
                      toggleExpanded(item.id)
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                      item.subMenu.some((sub) => isActive(sub.id))
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {expandedMenus.includes(item.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {expandedMenus.includes(item.id) && (
                    <ul className="mt-1 ml-4 flex flex-col gap-0.5">
                      {item.subMenu.map((sub) => (
                        <li key={sub.id}>
                          <button
                            onClick={() => onSelect(sub.id)}
                            className={cn(
                              "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all duration-200",
                              isActive(sub.id)
                                ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/25"
                                : "text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                            )}
                          >
                            <sub.icon className="w-4 h-4 shrink-0" />
                            <span>{sub.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleMenuSelect(item.id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive(item.id)
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25"
                      : "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40 text-center">
          &copy; 2025 GMS
        </p>
      </div>
    </aside>
  )
}

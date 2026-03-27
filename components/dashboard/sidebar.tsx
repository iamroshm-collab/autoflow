"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { getAllowedMenuIds, canAccessMenu, type UserRole } from "@/lib/access-control"
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
  ChevronsLeft,
  ChevronsRight,
  LogOut,
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
  { id: "settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  activeItem: string
  onSelect: (id: string) => void
  role: UserRole
  userName?: string
  onLogout?: () => void
}

export function Sidebar({ activeItem, onSelect, role, userName, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  const allowedIds = getAllowedMenuIds(role)
  const visibleMenuItems = menuItems.filter((item) => allowedIds.includes(item.id))

  const toggleExpanded = (id: string) => {
    setExpandedMenus((prev) => prev.includes(id) ? [] : [id])
  }

  const handleMenuSelect = (id: string) => {
    onSelect(id)
    setExpandedMenus([])
  }

  const isActive = (id: string) => activeItem === id

  const btnCls = (active: boolean) => cn(
    "flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
    collapsed ? "justify-center" : "gap-3",
    active
      ? "bg-[#eef2ff] text-[#4361ee]"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
  )

  const iconCls = (active: boolean) => cn(
    "w-[1.1rem] h-[1.1rem] shrink-0 transition-colors",
    active ? "text-[#4361ee]" : "text-slate-400"
  )

  const iconBtnCls = (active: boolean) => cn(
    "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150",
    active ? "bg-[#eef2ff] text-[#4361ee]" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
  )

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-white text-slate-700 rounded-2xl transition-all duration-300 overflow-hidden border border-slate-100 shadow-sm",
        collapsed ? "w-[60px]" : "w-60"
      )}
    >
      {/* Logo + collapse button */}
      <div className={cn(
        "flex items-center h-14 shrink-0 border-b border-slate-100",
        collapsed ? "justify-center px-3" : "justify-between px-4"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Image src="/autoflow-logo.svg?v=2" alt="AutoFlow" width={28} height={28} className="rounded shrink-0" unoptimized />
            <span className="text-sm font-semibold tracking-tight"><span style={{ color: "#020F48" }}>Auto</span><span style={{ color: "#3B82F6" }}>Flow</span></span>
          </div>
        )}
        {collapsed && (
          <Image src="/autoflow-logo.svg?v=2" alt="AutoFlow" width={28} height={28} className="rounded shrink-0" unoptimized />
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="flex justify-center pt-2 pb-1">
          <button
            onClick={() => setCollapsed(false)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-0.5">
          {/* Dashboard */}
          {allowedIds.includes("dashboard") && (
            <li>
              {collapsed ? (
                <button onClick={() => handleMenuSelect("dashboard")} className={iconBtnCls(isActive("dashboard"))} title="Dashboard">
                  <ClipboardList className={iconCls(isActive("dashboard"))} />
                </button>
              ) : (
                <button onClick={() => handleMenuSelect("dashboard")} className={btnCls(isActive("dashboard"))}>
                  <ClipboardList className={iconCls(isActive("dashboard"))} />
                  <span>Dashboard</span>
                </button>
              )}
            </li>
          )}

          {visibleMenuItems.map((item) => (
            <li key={item.id}>
              {item.subMenu ? (
                <div>
                  {collapsed ? (
                    <button
                      onClick={() => handleMenuSelect(item.subMenu![0].id)}
                      className={iconBtnCls(item.subMenu.some((s) => isActive(s.id)))}
                      title={item.label}
                    >
                      <item.icon className={iconCls(item.subMenu.some((s) => isActive(s.id)))} />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleExpanded(item.id)}
                        className={btnCls(item.subMenu.some((s) => isActive(s.id)))}
                      >
                        <item.icon className={iconCls(item.subMenu.some((s) => isActive(s.id)))} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {expandedMenus.includes(item.id) ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                      {expandedMenus.includes(item.id) && (
                        <ul className="mt-0.5 ml-4 flex flex-col gap-0.5">
                          {item.subMenu.map((sub) => (
                            <li key={sub.id}>
                              <button
                                onClick={() => onSelect(sub.id)}
                                className={cn(
                                  "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all duration-150",
                                  isActive(sub.id)
                                    ? "bg-[#eef2ff] text-[#4361ee]"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                )}
                              >
                                <sub.icon className={cn("w-4 h-4 shrink-0", isActive(sub.id) ? "text-[#4361ee]" : "text-slate-400")} />
                                <span>{sub.label}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              ) : collapsed ? (
                <button onClick={() => handleMenuSelect(item.id)} className={iconBtnCls(isActive(item.id))} title={item.label}>
                  <item.icon className={iconCls(isActive(item.id))} />
                </button>
              ) : (
                <button onClick={() => handleMenuSelect(item.id)} className={btnCls(isActive(item.id))}>
                  <item.icon className={iconCls(isActive(item.id))} />
                  <span>{item.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom: Logout */}
      <div className={cn("shrink-0 border-t border-slate-100 py-2 px-2", collapsed ? "flex flex-col items-center" : "")}>
        {collapsed ? (
          <button
            onClick={onLogout}
            className={iconBtnCls(false)}
            title="Logout"
          >
            <LogOut className="w-[1.1rem] h-[1.1rem] shrink-0 text-slate-400" />
          </button>
        ) : (
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-slate-500 hover:bg-red-50 hover:text-red-500"
          >
            <LogOut className="w-[1.1rem] h-[1.1rem] shrink-0" />
            <span>Logout</span>
          </button>
        )}
      </div>

    </aside>
  )
}


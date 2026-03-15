"use client"

import type { ReactNode } from "react"
import { Bell, Mail, Settings, UserCircle, Menu } from "lucide-react"

interface TopHeaderProps {
  onToggleSidebar?: () => void
  onSettings?: () => void
  heading?: ReactNode
}

export function TopHeader({ onToggleSidebar, onSettings, heading }: TopHeaderProps) {
  return (
    <header className="flex items-center justify-between h-14 px-6 bg-[#000F48] text-sidebar-foreground border-b border-sidebar-border shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors group"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-sidebar-foreground/70 group-hover:text-black" />
        </button>
        {heading || null}
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-sidebar-accent transition-colors group" aria-label="Notifications">
          <Bell className="w-5 h-5 text-sidebar-foreground/70 group-hover:text-black" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <button className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors group" aria-label="Messages">
          <Mail className="w-5 h-5 text-sidebar-foreground/70 group-hover:text-black" />
        </button>
        <button 
          onClick={onSettings}
          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors group"
        >
          <Settings className="w-4 h-4 text-sidebar-foreground/70 group-hover:text-black" />
          <span className="text-sm text-sidebar-foreground/70 group-hover:text-black hidden sm:inline">Settings</span>
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-sidebar-border">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-sidebar-foreground/70" />
          </div>
          <span className="text-sm font-medium hidden md:inline">Hi, Administrator</span>
        </div>
      </div>
    </header>
  )
}

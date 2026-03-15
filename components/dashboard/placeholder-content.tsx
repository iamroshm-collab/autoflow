"use client"

import { Construction } from "lucide-react"

interface PlaceholderContentProps {
  title: string
  icon: React.ElementType
}

export function PlaceholderContent({ title, icon: Icon }: PlaceholderContentProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-card text-card-foreground rounded-xl shadow-sm border border-border/50">
      <div className="flex flex-col items-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-heading font-semibold text-card-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            This section is under development. Navigate to the Dashboard to view the main overview.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-2">
          <Construction className="w-4 h-4" />
          <span>Coming soon</span>
        </div>
      </div>
    </div>
  )
}

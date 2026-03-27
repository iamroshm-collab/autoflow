"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClipboardList, Package, RotateCcw, FileText, Wrench, TrendingUpDown } from "lucide-react"

export type JobCardSubformTab =
  | "main-form"
  | "spare-parts-purchase"
  | "spare-part-return"
  | "service-description"
  | "technician-allocation"
  | "financial-transactions"

interface JobCardTabStripProps {
  value: JobCardSubformTab
  onValueChange: (value: JobCardSubformTab) => void
}

export function JobCardTabStrip({ value, onValueChange }: JobCardTabStripProps) {
  return (
    <div className={`global-tabs-wrap ${value === "main-form" ? "is-first" : "is-offset"}`}>
      <Tabs value={value} onValueChange={(v) => onValueChange(v as JobCardSubformTab)}>
        <div className="mb-2 mobile-only-tab-select">
          <Select value={value} onValueChange={(v) => onValueChange(v as JobCardSubformTab)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="main-form">Main Form</SelectItem>
              <SelectItem value="spare-parts-purchase">Spare Parts Purchase</SelectItem>
              <SelectItem value="spare-part-return">Spare Part Return</SelectItem>
              <SelectItem value="service-description">Service Description</SelectItem>
              <SelectItem value="technician-allocation">Technician Allocation</SelectItem>
              <SelectItem value="financial-transactions">Financial Transactions</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TabsList className="settings-tabs-list desktop-only-tab-strip">
          <TabsTrigger value="main-form" className="settings-tabs-trigger">
            <ClipboardList className="h-4 w-4 text-slate-600" />
            <span>Main Form</span>
          </TabsTrigger>
          <TabsTrigger value="spare-parts-purchase" className="settings-tabs-trigger">
            <Package className="h-4 w-4 text-slate-600" />
            <span>Spare Parts Purchase</span>
          </TabsTrigger>
          <TabsTrigger value="spare-part-return" className="settings-tabs-trigger">
            <RotateCcw className="h-4 w-4 text-slate-600" />
            <span>Spare Part Return</span>
          </TabsTrigger>
          <TabsTrigger value="service-description" className="settings-tabs-trigger">
            <FileText className="h-4 w-4 text-slate-600" />
            <span>Service Description</span>
          </TabsTrigger>
          <TabsTrigger value="technician-allocation" className="settings-tabs-trigger">
            <Wrench className="h-4 w-4 text-slate-600" />
            <span>Technician Allocation</span>
          </TabsTrigger>
          <TabsTrigger value="financial-transactions" className="settings-tabs-trigger">
            <TrendingUpDown className="h-4 w-4 text-slate-600" />
            <span>Financial Transactions</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}

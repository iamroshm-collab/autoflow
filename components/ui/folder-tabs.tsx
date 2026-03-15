'use client'

import * as React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type FolderTabItem = {
  value: string
  label: React.ReactNode
  content: React.ReactNode
}

interface FolderTabsProps {
  items: FolderTabItem[]
  defaultValue?: string
  className?: string
}

export default function FolderTabs({
  items,
  defaultValue,
  className,
}: FolderTabsProps) {
  return (
    <Tabs defaultValue={defaultValue ?? items[0]?.value} className={cn('w-full space-y-0', className)}>
      <div className="w-full">
        <TabsList className="w-full justify-start flex-wrap">
          {items.map((it, idx) => (
            <TabsTrigger
              key={it.value}
              value={it.value}
              className="data-[state=active]:shadow-none"
            >
              {it.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {items.map((it) => (
          <TabsContent
            key={it.value}
            value={it.value}
            className="mt-0 bg-white p-6 rounded-b-lg focus-visible:outline-none"
          >
            {it.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}

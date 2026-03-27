'use client'

import React from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import OneSignalProvider from '@/components/onesignal-provider'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <OneSignalProvider />
      {children}
    </TooltipProvider>
  )
}

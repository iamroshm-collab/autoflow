'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

const SIZE_CONFIG = {
  default: {
    root: { height: '24px', width: '44px', minHeight: '24px', minWidth: '44px', flexShrink: 0, alignSelf: 'center' as const },
    thumb: { height: '20px', width: '20px' },
    thumbClass: 'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
  },
  sm: {
    root: { height: '20px', width: '39px', minHeight: '20px', minWidth: '39px', flexShrink: 0, alignSelf: 'center' as const },
    thumb: { height: '14px', width: '14px' },
    thumbClass: 'data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-0',
  },
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & { size?: 'default' | 'sm' }
>(({ className, size = 'default', style, ...props }, ref) => {
  const config = SIZE_CONFIG[size]
  return (
    <SwitchPrimitives.Root
      className={cn(
        'peer inline-flex cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className,
      )}
      style={{ ...config.root, ...style }}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform',
          config.thumbClass,
        )}
        style={config.thumb}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }

'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer border-2 border-red-500 bg-transparent transition-all appearance-none',
      '!w-[20px] !h-[20px] !min-w-[20px] !min-h-[20px] !max-w-[20px] !max-h-[20px]',
      'shrink-0 grow-0 self-center rounded-[4px]',
      'flex items-center justify-center',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400',
      'data-[state=checked]:bg-red-500 data-[state=checked]:text-white',
      className,
    )}
    style={{ aspectRatio: '1 / 1' }}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <Check style={{ width: '14px', height: '14px' }} strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
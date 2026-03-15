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
    style={{ 
      width: '18px',      // Smaller size
      height: '18px',     // Smaller size
      minWidth: '18px', 
      minHeight: '18px',
      borderRadius: '3px', // Sharper corners for a smaller box
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      verticalAlign: 'middle', // Aligns it to the center of the text line
      flexShrink: 0,
    }}
    className={cn(
      'peer border-2 border-red-500 bg-transparent transition-all mt-[-2px]', // mt-[-2px] fine-tunes the vertical seat
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400',
      'data-[state=checked]:bg-red-500 data-[state=checked]:text-white',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <Check style={{ width: '12px', height: '12px' }} strokeWidth={4} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
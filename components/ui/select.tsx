'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'

// ─── Position-aware side computation ──────────────────────────────────────────
// Compare the trigger's vertical centre against the screen centre.
// Triggers in the bottom half of the screen open upward; top half open downward.
function computeSide(rect: DOMRect): 'top' | 'bottom' {
  return rect.top + rect.height / 2 > window.innerHeight / 2 ? 'top' : 'bottom'
}

// ─── Context — uses a ref so side is set SYNCHRONOUSLY before Content renders ─
// useState is async-batched; SelectContent would always read the stale 'bottom'.
type SelectSideCtx = {
  sideRef: React.MutableRefObject<'top' | 'bottom'>
}

const SelectSideContext = React.createContext<SelectSideCtx>({
  sideRef: { current: 'bottom' },
})

// ─── Select (root wrapper) ────────────────────────────────────────────────────
const Select: React.FC<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>> = ({
  children,
  ...props
}) => {
  const sideRef = React.useRef<'top' | 'bottom'>('bottom')

  // onPointerDownCapture fires in the CAPTURE phase — before any child handler
  // and before Radix's internal flushSync render, so sideRef is always set
  // before SelectContent reads it.
  const handleCapture = React.useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    const trigger = (e.target as HTMLElement).closest('[role="combobox"]')
    if (trigger) sideRef.current = computeSide(trigger.getBoundingClientRect())
  }, [])

  return (
    <SelectSideContext.Provider value={{ sideRef }}>
      <span onPointerDownCapture={handleCapture} style={{ display: 'contents' }}>
        <SelectPrimitive.Root {...props}>{children}</SelectPrimitive.Root>
      </span>
    </SelectSideContext.Provider>
  )
}

const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

// ─── SelectTrigger ────────────────────────────────────────────────────────────
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-sm border border-border/90 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground/90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 [&>span]:line-clamp-1',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

// ─── Scroll buttons ───────────────────────────────────────────────────────────
const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

// ─── SelectContent ────────────────────────────────────────────────────────────
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => {
  const { sideRef } = React.useContext(SelectSideContext)

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        // Read ref synchronously — always correct at render time
        side={sideRef.current}
        avoidCollisions={false}
        className={cn(
          // Use globals.css dropdown-scroll for consistent border/bg/shadow/radius
          'thin-scrollbar',
          'relative z-50 min-w-[8rem]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        style={{
          // Half the screen minus bars — list never overruns either bar
          maxHeight: 'calc(50vh - 80px)',
          // Keep overflow hidden so Radix scroll buttons work with the portal viewport
          overflowY: 'hidden',
          ...((props as any).style ?? {}),
        }}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
SelectContent.displayName = SelectPrimitive.Content.displayName

// ─── SelectLabel ──────────────────────────────────────────────────────────────
const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

// ─── SelectItem ───────────────────────────────────────────────────────────────
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      // Match globals.css .dropdown-item sizing
      'relative flex w-full cursor-default select-none items-center',
      'min-h-[2.5rem] pl-8 pr-3 py-[0.4rem]',
      'text-sm text-slate-700',
      'outline-none transition-colors duration-150',
      // Match globals.css hover / focus / selected colours
      'hover:bg-blue-50 hover:text-slate-800',
      'focus:bg-blue-50 focus:text-slate-800',
      'data-[state=checked]:bg-blue-100 data-[state=checked]:font-medium data-[state=checked]:text-slate-800',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      // First/last radius matching dropdown-item
      'first:rounded-t-[0.375rem] last:rounded-b-[0.375rem]',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

// ─── SelectSeparator ──────────────────────────────────────────────────────────
const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}

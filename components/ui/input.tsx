import * as React from 'react'

import { cn } from '@/lib/utils'
import { formatTextByField } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, onBlur, onChange, ...props }, ref) => {
    const isNumber = type === 'number'
    const generatedId = React.useId()
    const resolvedId = (props as any).id ?? ((props as any).name ? `${(props as any).name}-${generatedId}` : `input-${generatedId}`)

    // For better cross-browser control (remove native spinners), render numeric inputs
    // as text with `inputMode` and `pattern`. This preserves numeric keyboard on mobile
    // while avoiding browser spinner UI (Edge/Chromium/Firefox).
    const inputType = isNumber ? 'text' : type
    const numberProps = isNumber
      ? { inputMode: 'decimal' as const, pattern: '[0-9]*', 'data-original-type': 'number' }
      : {}

    const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      // Apply text case formatting on blur for text inputs (not number, date, etc)
      // Check for type === 'text' OR type === undefined (default is text)
      const isTextInput = type === 'text' || type === undefined || type === ''
      if (isTextInput && !((props as any)?.noFormatting) && e.currentTarget.value) {
        const fieldName = (props as any)?.name
        const formatted = formatTextByField(e.currentTarget.value, fieldName)
        if (formatted !== e.currentTarget.value) {
          e.currentTarget.value = formatted
          // Trigger onChange to update the form state
          const changeEvent = new Event('change', { bubbles: true })
          Object.defineProperty(changeEvent, 'target', {
            value: e.currentTarget,
            enumerable: true
          })
          onChange?.(changeEvent as any)
        }
      }
      onBlur?.(e)
    }, [type, onChange, onBlur, props])

    return (
      <input
        id={resolvedId}
        type={inputType}
        autoComplete="off"
        className={cn(
          'flex h-10 w-full rounded-sm border border-border/90 bg-muted/30 px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm',
          isNumber && 'no-spinner',
          className,
        )}
        ref={ref}
        onBlur={handleBlur}
        onChange={onChange}
        style={
          isNumber
            ? {
                WebkitAppearance: 'none',
                appearance: 'textfield',
                MozAppearance: 'textfield',
                overflow: 'hidden',
              }
            : undefined
        }
        {...numberProps}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }

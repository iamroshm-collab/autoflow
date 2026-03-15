import * as React from 'react'
import { Input } from '@/components/ui/input'
import { formatTextByField } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface TextFormatterInputProps extends React.ComponentProps<'input'> {
  /**
   * Field name to determine case formatting.
   * Fields with 'registration', 'pan', 'gstin', 'gst', 'billnumber', or 'id' -> UPPERCASE
   * All others -> Proper Case (Title Case)
   */
  fieldName?: string
  /**
   * If true, skip text formatting
   */
  noFormatting?: boolean
}

/**
 * Enhanced Input component that automatically formats text case based on field name
 * - Registration numbers, PAN, GSTIN, GST, Bill Numbers, IDs -> UPPERCASE
 * - All other text fields -> Proper Case (Title Case)
 */
export const TextFormatterInput = React.forwardRef<HTMLInputElement, TextFormatterInputProps>(
  ({ 
    value, 
    onChange, 
    onBlur, 
    fieldName, 
    noFormatting,
    type = 'text',
    ...props 
  }, ref) => {
    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e)
    }, [onChange])

    const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      if (!noFormatting && type === 'text' && e.currentTarget.value) {
        const formatted = formatTextByField(e.currentTarget.value, fieldName)
        if (formatted !== e.currentTarget.value) {
          e.currentTarget.value = formatted
          // Trigger onChange with the formatted value
          const event = new Event('change', { bubbles: true })
          Object.defineProperty(event, 'target', { 
            value: e.currentTarget, 
            enumerable: true 
          })
          onChange?.(event as any)
        }
      }
      onBlur?.(e)
    }, [onChange, onBlur, fieldName, noFormatting, type])

    return (
      <Input
        ref={ref}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)

TextFormatterInput.displayName = 'TextFormatterInput'

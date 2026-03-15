import { useState, useCallback } from 'react'
import { formatTextByField } from '@/lib/utils'

export interface UseTextCaseFormatterOptions {
  fieldName?: string
  onBlur?: () => void
}

/**
 * Hook to handle text case formatting for form inputs
 * Automatically converts text to proper case or uppercase based on field name
 */
export function useTextCaseFormatter(
  value: string,
  onChange: (value: string) => void,
  options?: UseTextCaseFormatterOptions
) {
  const handleBlur = useCallback(() => {
    if (value) {
      const formatted = formatTextByField(value, options?.fieldName)
      if (formatted !== value) {
        onChange(formatted)
      }
    }
    options?.onBlur?.()
  }, [value, onChange, options])

  return {
    onBlur: handleBlur,
  }
}

/**
 * Helper to create change handler that formats on blur
 */
export function createTextFormatter(
  onChange: (value: string) => void,
  fieldName?: string
) {
  return {
    handleBlur: (value: string) => {
      if (value) {
        const formatted = formatTextByField(value, fieldName)
        onChange(formatted)
      }
    },
  }
}

'use client'

import { useEffect } from 'react'

/**
 * Ensures layout CSS is marked as used by the browser,
 * eliminating the preload warning
 */
export function CSSLoader() {
  useEffect(() => {
    // Force browser to recognize CSS as used
    if (typeof document !== 'undefined') {
      // Trigger a layout recalculation to ensure CSS is consumed
      void document.documentElement.offsetHeight
    }
  }, [])

  return null
}

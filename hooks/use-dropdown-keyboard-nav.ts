import { useState, useRef, useEffect, useCallback } from "react"

interface UseDropdownKeyboardNavProps {
  itemCount: number
  isOpen: boolean
  onSelect: (index: number) => void
  onClose?: () => void
}

export function useDropdownKeyboardNav({
  itemCount,
  isOpen,
  onSelect,
  onClose,
}: UseDropdownKeyboardNavProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const highlightedItemRef = useRef<HTMLButtonElement | null>(null)

  // Reset highlighted index when dropdown opens/closes or items change
  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1)
    }
  }, [isOpen, itemCount])

  // Auto-scroll to highlighted item
  useEffect(() => {
    if (highlightedItemRef.current && highlightedIndex >= 0) {
      highlightedItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    }
  }, [highlightedIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || itemCount === 0) {
        return
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setHighlightedIndex((prev) =>
            prev < itemCount - 1 ? prev + 1 : prev
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
          break
        case "Enter":
          e.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < itemCount) {
            onSelect(highlightedIndex)
          }
          break
        case "Escape":
          e.preventDefault()
          onClose?.()
          break
      }
    },
    [isOpen, itemCount, highlightedIndex, onSelect, onClose]
  )

  const getItemProps = useCallback(
    (index: number) => ({
      ref: index === highlightedIndex ? highlightedItemRef : null,
      "data-highlighted": index === highlightedIndex,
    }),
    [highlightedIndex]
  )

  const resetHighlight = useCallback(() => {
    setHighlightedIndex(-1)
  }, [])

  return {
    highlightedIndex,
    highlightedItemRef,
    handleKeyDown,
    getItemProps,
    resetHighlight,
    setHighlightedIndex,
  }
}

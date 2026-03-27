"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  cn,
  formatDateDDMMYY,
  formatDateToISODate,
  parseDDMMYYToISO,
  parseISODateToLocalDate,
} from "@/lib/utils"

interface DatePickerInputProps {
  value?: string // Can be ISO format (YYYY-MM-DD) or dd-mm-yy format
  onChange?: (value: string) => void // Returns same format as input
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  format?: "iso" | "dd-mm-yy" // Whether input/output is ISO or dd-mm-yy
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = "dd-mm-yy",
  disabled = false,
  id,
  className,
  format = "iso",
}: DatePickerInputProps) {
  const [inputValue, setInputValue] = React.useState("")
  const [open, setOpen] = React.useState(false)

  // Initialize and update input value when prop changes
  React.useEffect(() => {
    if (value) {
      if (format === "dd-mm-yy") {
        // If value is in dd-mm-yy format, use it directly
        setInputValue(value)
      } else {
        // If value is in ISO format, convert to dd-mm-yy for display
        setInputValue(formatDateDDMMYY(value))
      }
    } else {
      setInputValue("")
    }
  }, [value, format])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Try to parse and emit based on format
    if (format === "dd-mm-yy") {
      // User entered dd-mm-yy, validate and emit as dd-mm-yy
      const isoDate = parseDDMMYYToISO(newValue)
      if (isoDate) {
        onChange?.(newValue)
      } else if (newValue.trim() === "") {
        onChange?.("")
      }
    } else {
      // For ISO format, convert from dd-mm-yy input to ISO
      const isoDate = parseDDMMYYToISO(newValue)
      if (isoDate) {
        onChange?.(isoDate)
      } else if (newValue.trim() === "") {
        onChange?.("")
      }
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const isoString = formatDateToISODate(date)
      const formatted = formatDateDDMMYY(isoString)
      setInputValue(formatted)

      // Emit based on format
      if (format === "dd-mm-yy") {
        onChange?.(formatted)
      } else {
        onChange?.(isoString)
      }
      setOpen(false)
    }
  }

  // Convert value to Date for calendar selection
  let selectedDate: Date | undefined
  if (value) {
    if (format === "dd-mm-yy") {
      const isoDate = parseDDMMYYToISO(value)
      selectedDate = isoDate ? parseISODateToLocalDate(isoDate) || undefined : undefined
    } else {
      selectedDate = parseISODateToLocalDate(value) || new Date(value)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled}
          className={cn("h-10 cursor-pointer", className)}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 border bg-white rounded-md shadow-lg" align="start" side="top" sideOffset={4}>
        <CalendarComponent
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export default DatePickerInput

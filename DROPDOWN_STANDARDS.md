# Dropdown Standards and Guidelines

This document defines the standard dropdown implementation patterns for the application to ensure consistency across all forms and components.

## Global CSS Classes

### `.dropdown-scroll`
Container class for dropdown lists with hidden scrollbar.

**Properties:**
- Max height: 15rem (240px)
- Hidden scrollbar (all browsers)
- Smooth scrolling behavior
- Prevents text selection during scroll
- Contains scroll within bounds

**Usage:**
```jsx
<div className="max-h-60 dropdown-scroll">
  {/* dropdown items */}
</div>
```

### `.dropdown-item`
Standardized class for individual dropdown items.

**Properties:**
- Full width
- Left-aligned text
- Consistent padding (0.5rem 0.75rem)
- Font size: 0.875rem (14px)
- Border-bottom between items
- Smooth transition effects
- Hover: light blue background (blue-50)
- Selected: blue-100 background

**Usage:**
```jsx
<button className={`dropdown-item ${isSelected ? "selected" : ""}`}>
  Item Text
</button>
```

## Popover-Based Dropdowns (Recommended)

For most dropdown use cases, use the Popover component from Radix UI.

### Default Behavior
- **Always opens downward** (`side="bottom"`)
- **Collision padding**: 16px to stay within modals
- **Avoids collisions**: Auto-adjusts position if needed
- **Proper z-index**: Appears above other content

### Standard Implementation Pattern

```jsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useRef, useState, useEffect } from "react"

function MyDropdown() {
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [filter, setFilter] = useState("")
  
  const listRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && optionRefs.current[selectedIndex]) {
      optionRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [selectedIndex])

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <Popover
      open={showDropdown}
      onOpenChange={(open) => {
        setShowDropdown(open)
        if (!open) setSelectedIndex(-1)
      }}
    >
      <PopoverTrigger asChild>
        <div className="w-full">
          <Input
            placeholder="Search and select..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setShowDropdown(true)
              setSelectedIndex(-1)
            }}
            onKeyDown={(e) => {
              if (!showDropdown) return
              
              switch (e.key) {
                case "ArrowDown":
                  e.preventDefault()
                  setSelectedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                  )
                  break
                case "ArrowUp":
                  e.preventDefault()
                  setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
                  break
                case "Enter":
                  e.preventDefault()
                  if (selectedIndex >= 0 && filteredOptions[selectedIndex]) {
                    handleSelect(filteredOptions[selectedIndex])
                    setShowDropdown(false)
                  }
                  break
                case "Escape":
                  e.preventDefault()
                  setShowDropdown(false)
                  break
              }
            }}
            autoComplete="off"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div
          ref={listRef}
          className="max-h-60 dropdown-scroll"
          onWheel={(e) => {
            // Fix for modal scroll-lock
            const el = listRef.current
            if (!el) return
            el.scrollTop += e.deltaY
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <button
                key={option.id}
                ref={(el) => {
                  optionRefs.current[index] = el
                }}
                onClick={() => {
                  handleSelect(option)
                  setShowDropdown(false)
                }}
                className={`dropdown-item ${
                  index === selectedIndex ? "selected" : ""
                }`}
              >
                {option.name}
              </button>
            ))
          ) : (
            <div className="px-4 py-2 text-muted-foreground text-sm">
              No options found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### Key Features

1. **Keyboard Navigation**
   - Arrow Up/Down: Navigate options
   - Enter: Select current option
   - Escape: Close dropdown
   - Auto-scrolls selected item into view

2. **Modal Compatibility**
   - `onWheel` handler prevents dialog scroll-lock issues
   - Proper z-index management
   - Collision padding keeps dropdown within modal

3. **Search/Filter**
   - Input-based search
   - Real-time filtering
   - Clear visual feedback

4. **Accessibility**
   - Keyboard accessible
   - ARIA attributes
   - Focus management

## Command Component Dropdowns

For more complex dropdowns with grouping and search, use the Command component.

```jsx
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function MyCommandDropdown() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}>
          {value || "Select option..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    setValue(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

## Absolute Position Dropdowns (Legacy)

Only use absolute positioning when Popover cannot be used (rare cases).

```jsx
<div className="relative">
  <Input
    value={value}
    onChange={(e) => setValue(e.target.value)}
    onFocus={() => setShowDropdown(true)}
  />
  {showDropdown && (
    <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-48 dropdown-scroll">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => handleSelect(option)}
          className="dropdown-item"
        >
          {option.name}
        </button>
      ))}
    </div>
  )}
</div>
```

## Updated Files

The following files have been updated to use the new dropdown standards:

1. **components/ui/popover.tsx**
   - Added `side="bottom"` default
   - Added `collisionPadding={16}`
   - Added `avoidCollisions={true}`

2. **app/globals.css**
   - Enhanced `.dropdown-scroll` class
   - Added `.dropdown-item` class with hover/selected states

3. **components/settings/spare-part-shops-form.tsx**
   - Uses `.dropdown-item` class
   - Proper keyboard navigation
   - Modal scroll-lock fix

4. **components/dashboard/supplier-product-inventory-form.tsx**
   - Uses `.dropdown-item` class
   - Consistent with pattern

5. **components/dashboard/employee-master-form.tsx**
   - Uses `.dropdown-item` class
   - Updated button styling

## Future Dropdown Implementations

When creating new dropdowns:

1. ✅ Use Popover-based pattern (see "Standard Implementation Pattern" above)
2. ✅ Apply `.dropdown-scroll` to the scrollable container
3. ✅ Apply `.dropdown-item` to each option button
4. ✅ Add `selected` class for highlighted items
5. ✅ Implement keyboard navigation (Arrow keys, Enter, Escape)
6. ✅ Add refs for auto-scroll behavior
7. ✅ Include `onWheel` handler if used in modals
8. ✅ Set `align="start"` and `sideOffset={6}` on PopoverContent
9. ✅ Use `w-[var(--radix-popover-trigger-width)]` for width matching
10. ✅ Always set `side="bottom"` (now default in PopoverContent)

## Testing Checklist

Before deploying a new dropdown:

- [ ] Mouse click selection works
- [ ] Keyboard navigation works (Arrow Up/Down, Enter, Escape)
- [ ] Mouse wheel scrolling works (including in modals)
- [ ] Dropdown stays within modal boundaries
- [ ] Dropdown opens downward
- [ ] Selected item is visually highlighted
- [ ] Search/filter updates list correctly
- [ ] No console errors
- [ ] Proper z-index (appears above other content)
- [ ] Scrollbar is hidden but scrolling works

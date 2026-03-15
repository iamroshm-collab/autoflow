# Dropdown Implementation Guide

## Overview
All dropdowns in the application use standardized styling and behavior to ensure consistency across the UI. The core styles are defined in `app/globals.css`.

## CSS Classes

### `.dropdown-scroll`
Container for scrollable dropdown list.
```css
.dropdown-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  max-height: 15rem; /* 240px */
  scroll-behavior: smooth;
  user-select: none;
  background-color: white;
  border: 1px solid rgb(226 232 240); /* slate-200 */
  border-radius: 0.375rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

### `.dropdown-item`
Individual dropdown menu item - use on `<button>` elements.
```css
.dropdown-item {
  width: 100%;
  display: block;
  text-align: left;
  padding: 0.75rem 0.875rem;
  font-size: 0.875rem;
  color: rgb(51 65 85);
  border: none;
  border-bottom: 1px solid rgb(226 232 240);
  background-color: white;
  cursor: pointer;
  transition: background-color 150ms;
}

.dropdown-item:hover {
  background-color: rgb(239 246 255); /* blue-50 */
  color: rgb(30 41 59); /* slate-800 */
}

.dropdown-item.selected {
  background-color: rgb(219 234 254); /* blue-100 */
  color: rgb(30 41 59);
  font-weight: 500;
}
```

### `.dropdown-scroll-modal`
Use in modal forms to constrain dropdown height.
```css
.dropdown-scroll-modal {
  max-height: 12rem; /* Slightly smaller for modals */
}
```

## Implementation Patterns

### Pattern 1: Popover-based Dropdown (Recommended for Forms)
Used in modals and forms with controlled state.

```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useRef, useEffect } from "react"

export default function MyForm() {
  const [filter, setFilter] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    const filtered = items.filter(item =>
      filter === "" || item.name.toLowerCase().includes(filter.toLowerCase())
    )

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex(prev => prev < filtered.length - 1 ? prev + 1 : prev)
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0 && filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex])
          setIsOpen(false)
        }
        break
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Input
          placeholder="Search..."
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setIsOpen(true)
            setSelectedIndex(-1)
          }}
          onKeyDown={handleKeyDown}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div
          ref={listRef}
          className="max-h-60 dropdown-scroll"
          onWheel={(e) => {
            // Handle scroll in modals/dialogs
            const el = listRef.current
            if (!el) return
            el.scrollTop += e.deltaY
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {items
            .filter(item => filter === "" || item.name.toLowerCase().includes(filter.toLowerCase()))
            .map((item, index) => (
              <button
                key={item.id}
                ref={(el) => {
                  optionRefs.current[index] = el
                }}
                onClick={() => {
                  handleSelect(item)
                  setIsOpen(false)
                  setSelectedIndex(-1)
                }}
                className={`dropdown-item ${selectedIndex === index ? "selected" : ""}`}
              >
                {item.name}
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### Pattern 2: Absolute Positioned Dropdown
Used for simple, non-modal dropdowns.

```tsx
export default function VehicleSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  return (
    <div className="relative">
      <Input
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        placeholder="Select vehicle..."
      />
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-48 dropdown-scroll">
          {vehicles.map((vehicle, idx) => (
            <button
              key={vehicle.id}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(vehicle)
                setIsOpen(false)
              }}
              className={`dropdown-item ${selectedIndex === idx ? "selected" : ""}`}
            >
              {vehicle.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Pattern 3: Fixed Positioned Dropdown (For Side Panels)
Used for dropdowns in fixed/absolute positioned elements like side panels.

```tsx
export default function ShopAutocomplete() {
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  const updatePosition = () => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (rect) {
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        onFocus={updatePosition}
        onClick={updatePosition}
      />
      {open && (
        <div
          className="fixed z-[9999] max-h-[300px] dropdown-scroll"
          style={{
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
          }}
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`dropdown-item ${isSelected ? "selected" : ""}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Key Features

### ✅ Always Opens Downward
- Use `align="start"` and `sideOffset={6}` on PopoverContent
- For absolute positioned: `top-full` class
- For fixed positioned: calculate top position

### ✅ Stays Inside Modal
- Use PopoverContent with proper z-index
- Add `onWheel` handler to handle dialog scroll-lock
- Use refs to scroll items into view on keyboard navigation

### ✅ Hidden Scrollbar
- `.dropdown-scroll` class hides scrollbar via CSS
- Works across browsers (Firefox, Chrome, Safari, Edge)

### ✅ Keyboard Navigation
- ArrowUp/ArrowDown: Select previous/next item
- Enter: Select item and close dropdown
- Escape: Close dropdown
- Type to filter (if applicable)

### ✅ Smooth Scrolling
- `scroll-behavior: smooth` for automatic scrolling
- `scrollIntoView()` for keyboard navigation

### ✅ Consistent Styling
- Blue highlight on selection (`bg-blue-100`)
- Light blue on hover (`bg-blue-50`)
- Subtle borders and shadows

## Updated Components

The following components have been updated to use standardized dropdown styling:

✅ `components/settings/spare-part-shops-form.tsx` - State dropdowns in Add/Edit modals
✅ `components/dashboard/supplier-product-inventory-form.tsx` - State dropdown with full keyboard nav
✅ `components/SupplierAutocomplete.tsx` - Autocomplete dropdown
✅ `components/ShopAutocomplete.tsx` - Fixed position dropdown
✅ `components/dashboard/add-vehicle-modal.tsx` - Make/Model dropdowns
✅ `components/dashboard/new-job-card-form.tsx` - Vehicle/Customer/Service dropdowns
✅ `components/dashboard/employee-master-form.tsx` - Employee selection dropdown
✅ `components/inventory/purchase-entry-form.tsx` - Supplier selection dropdown

## Testing Checklist

When implementing a new dropdown, verify:

- [ ] Dropdown opens downward
- [ ] Dropdown stays within bounds (modal or viewport)
- [ ] Scrollbar is hidden and scroll works with mouse wheel
- [ ] Keyboard navigation works (Arrow keys, Enter, Escape)
- [ ] Selected item is highlighted with blue-100
- [ ] Hover shows light blue-50
- [ ] Items have proper padding and spacing
- [ ] Dropdown closes when selecting or pressing Escape
- [ ] Filter/search works if applicable

## Future Implementations

When adding NEW dropdowns in the future:

1. **Use PopoverContent** for modals (preferred)
   - More accessible and well-tested component
   - Natural positioning handling

2. **Use absolute positioning** for simple lists
   - Use `top-full left-0 right-0 mt-1` classes
   - Add `z-50` and proper shadow

3. **Use fixed positioning** for side panels/fixed containers
   - Calculate position dynamically
   - Use `z-[9999]` for top layer

4. **Always use `dropdown-item` class** for menu items
   - Ensures consistency
   - Button elements for better accessibility

5. **Always use `dropdown-scroll` class** for scrollable container
   - Hides scrollbar automatically
   - Provides proper sizing and styling

6. **Add keyboard navigation**
   - At minimum: Arrow keys, Enter, Escape
   - Use `useEffect` to handle `scrollIntoView` on selection

7. **For modals, add `onWheel` handler**
   - Dialog scroll-lock can block wheel events
   - Manually adjust `scrollTop`

## Troubleshooting

### Dropdown appears behind modal
- Increase z-index to `z-[100]` or higher
- Ensure PopoverContent is inside Dialog content

### Scrollbar still showing
- Check that `.dropdown-scroll` class is applied
- Verify no inline `overflow: scroll` style

### Items not scrolling smoothly
- Ensure parent container has max-height
- Add ref and onWheel handler for modals

### Keyboard navigation not working
- Verify onKeyDown handler is on input/trigger element
- Check that refs are properly assigned to items
- Ensure selectedIndex state is updated correctly


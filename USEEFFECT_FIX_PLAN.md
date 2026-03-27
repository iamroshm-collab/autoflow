# useEffect Hook Dependency Array Fix Plan

**File:** `components/dashboard/update-job-card-form.tsx`

**Objective:** Wrap the two problematic arrow functions with `useCallback` to eliminate stale closure risks and properly manage their dependencies.

---

## PART 1: Import Statement Changes

### Current (Line 2):
```typescript
import { useEffect, useMemo, useRef, useState } from "react"
```

### Proposed:
```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
```

**Rationale:** `useCallback` must be imported from React to wrap the handlers.

---

## PART 2: `handleRegistrationInputChange` Function

### Current (Lines 1103–1129):
```typescript
const handleRegistrationInputChange = (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  // Don't allow input changes while selection is locked
  if (selectionLockRef.current) {
    return
  }
  
  const value = e.target.value.toUpperCase()

  setSuppressAutoReload(true)

  setFormData((prev) => ({
    ...prev,
    registrationNumber: value,
    jobCardId: "",
    customerId: "",
    vehicleId: "",
    customerName: "",
    vehicleModel: "",
  }))

  // Filter and show dropdown as user types
  fetchRegistrationSuggestions(value)
  setShowRegistrationSuggestions(true)
}
```

### Dependency Analysis:

| Reference | Type | Stable? | Analysis |
|-----------|------|---------|----------|
| `selectionLockRef.current` | useRef | ✅ | Stable ref object |
| `e.target.value` | parameter | ✅ | Parameter value |
| `setSuppressAutoReload` | setState | ✅ | setState is always stable |
| `setFormData` | setState | ✅ | setState is always stable |
| `fetchRegistrationSuggestions` | function | ⚠️ | Function defined in same component, recreated on every render |
| `setShowRegistrationSuggestions` | setState | ✅ | setState is always stable |

**Issue:** `fetchRegistrationSuggestions` is a function defined at line 1083 that will be recreated on every render. When `handleRegistrationInputChange` captures it in its closure, it captures the OLD version. This causes stale closure behavior.

### Proposed (Lines 1103–1129):
```typescript
const handleRegistrationInputChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't allow input changes while selection is locked
    if (selectionLockRef.current) {
      return
    }
    
    const value = e.target.value.toUpperCase()

    setSuppressAutoReload(true)

    setFormData((prev) => ({
      ...prev,
      registrationNumber: value,
      jobCardId: "",
      customerId: "",
      vehicleId: "",
      customerName: "",
      vehicleModel: "",
    }))

    // Filter and show dropdown as user types
    fetchRegistrationSuggestions(value)
    setShowRegistrationSuggestions(true)
  },
  [fetchRegistrationSuggestions]
)
```

**Callback Dependency Array:** `[fetchRegistrationSuggestions]`

**Rationale:** 
- `selectionLockRef.current`, `setSuppressAutoReload`, `setFormData`, `setShowRegistrationSuggestions` are all stable (refs and setState)
- `fetchRegistrationSuggestions` is the only dependency that changes across renders, so it must be in the array
- Once `fetchRegistrationSuggestions` is itself wrapped with useCallback, this callback will be stable

---

## PART 3: `handleSelectRegistrationSuggestion` Function

### Current (Lines 1130–1183):
```typescript
const handleSelectRegistrationSuggestion = async (
  suggestion: RegistrationSuggestion
) => {
  const selectedId = suggestion.id
  console.log("handleSelectRegistrationSuggestion called:", { selectedId, reg: suggestion.registrationNumber })
  
  // Check if already selecting
  if (selectionLockRef.current || isSelectingSuggestion) {
    console.log("Selection blocked - already selecting")
    return
  }
  
  // Lock the selection immediately
  selectionLockRef.current = true
  selectedSuggestionRef.current = suggestion
  
  // Immediately close dropdown and prevent all updates
  setShowRegistrationSuggestions(false)
  setIsLoadingSuggestions(false)
  setRegistrationSuggestions([])
  setIsSelectingSuggestion(true)
  setSuppressAutoReload(true)
  
  // Cancel any pending debounced fetches
  if (suggestionDebounceRef.current) {
    clearTimeout(suggestionDebounceRef.current)
  }
  
  const makeModel = [suggestion.vehicleMake, suggestion.vehicleModel]
    .filter(Boolean)
    .join(" ")

  setFormData((prev) => ({
    ...prev,
    fileNo: suggestion.fileNo,
    mobileNo: suggestion.mobileNo,
    registrationNumber: suggestion.registrationNumber,
    vehicleModel: makeModel || prev.vehicleModel,
    jobCardId: selectedId,
    customerId: "",
    vehicleId: "",
    customerName: "",
  }))

  try {
    await loadJobCard(selectedId)
  } catch (error) {
    console.error('Error loading job card:', error)
  } finally {
    setSuppressAutoReload(false)
    setIsSelectingSuggestion(false)
    selectionLockRef.current = false
    selectedSuggestionRef.current = null
  }
}
```

### Dependency Analysis:

| Reference | Type | Stable? | Analysis |
|-----------|------|---------|----------|
| `suggestion` | parameter | ✅ | Parameter (extracted in closure) |
| `selectedId` | derived | ✅ | Derived from parameter |
| `selectionLockRef.current` | useRef | ✅ | Stable ref object |
| `isSelectingSuggestion` | state | ⚠️ | State value (changes, must be in dependency array) |
| `selectedSuggestionRef.current` | useRef | ✅ | Stable ref object |
| `setShowRegistrationSuggestions` | setState | ✅ | setState is always stable |
| `setIsLoadingSuggestions` | setState | ✅ | setState is always stable |
| `setRegistrationSuggestions` | setState | ✅ | setState is always stable |
| `setIsSelectingSuggestion` | setState | ✅ | setState is always stable |
| `setSuppressAutoReload` | setState | ✅ | setState is always stable |
| `suggestionDebounceRef.current` | useRef | ✅ | Stable ref object |
| `setFormData` | setState | ✅ | setState is always stable |
| `loadJobCard` | function | ⚠️ | Function defined in same component, recreated on every render |

**Critical Issues:**
1. `isSelectingSuggestion` state is captured in closure. If state changes, the closure has stale value.
2. `loadJobCard` is a function defined elsewhere in component (line 868) that gets recreated every render

### Proposed (Lines 1130–1183):
```typescript
const handleSelectRegistrationSuggestion = useCallback(
  async (suggestion: RegistrationSuggestion) => {
    const selectedId = suggestion.id
    console.log("handleSelectRegistrationSuggestion called:", { selectedId, reg: suggestion.registrationNumber })
    
    // Check if already selecting
    if (selectionLockRef.current || isSelectingSuggestion) {
      console.log("Selection blocked - already selecting")
      return
    }
    
    // Lock the selection immediately
    selectionLockRef.current = true
    selectedSuggestionRef.current = suggestion
    
    // Immediately close dropdown and prevent all updates
    setShowRegistrationSuggestions(false)
    setIsLoadingSuggestions(false)
    setRegistrationSuggestions([])
    setIsSelectingSuggestion(true)
    setSuppressAutoReload(true)
    
    // Cancel any pending debounced fetches
    if (suggestionDebounceRef.current) {
      clearTimeout(suggestionDebounceRef.current)
    }
    
    const makeModel = [suggestion.vehicleMake, suggestion.vehicleModel]
      .filter(Boolean)
      .join(" ")

    setFormData((prev) => ({
      ...prev,
      fileNo: suggestion.fileNo,
      mobileNo: suggestion.mobileNo,
      registrationNumber: suggestion.registrationNumber,
      vehicleModel: makeModel || prev.vehicleModel,
      jobCardId: selectedId,
      customerId: "",
      vehicleId: "",
      customerName: "",
    }))

    try {
      await loadJobCard(selectedId)
    } catch (error) {
      console.error('Error loading job card:', error)
    } finally {
      setSuppressAutoReload(false)
      setIsSelectingSuggestion(false)
      selectionLockRef.current = false
      selectedSuggestionRef.current = null
    }
  },
  [isSelectingSuggestion, loadJobCard]
)
```

**Callback Dependency Array:** `[isSelectingSuggestion, loadJobCard]`

**Rationale:**
- `isSelectingSuggestion` is state that changes, so it MUST be in the dependency array
- `loadJobCard` is a function that changes on every render, so it must be in the dependency array
- All other references are either stable (refs, setState) or parameters/derived values
- The callback will be recreated only when `isSelectingSuggestion` or `loadJobCard` change

---

## PART 4: `fetchRegistrationSuggestions` Function

**Current (Lines 1083–1101):**
```typescript
const fetchRegistrationSuggestions = async (inputValue: string) => {
  // Filter allVehicles based on input
  const query = inputValue.trim().toUpperCase()
  
  if (!query) {
    // Show all vehicles if empty
    setRegistrationSuggestions(allVehicles)
  } else {
    // Filter by registration number or customer name
    setRegistrationSuggestions(
      allVehicles.filter(
        (v) =>
          v.registrationNumber.includes(query) ||
          v.customerName.toUpperCase().includes(query)
      )
    )
  }
  dropdownNav.resetHighlight()
}
```

### Dependency Analysis:

| Reference | Type | Stable? | Analysis |
|-----------|------|---------|----------|
| `inputValue` | parameter | ✅ | Parameter |
| `setRegistrationSuggestions` | setState | ✅ | setState is always stable |
| `allVehicles` | state | ⚠️ | State value (changes, must be in dependency array) |
| `dropdownNav.resetHighlight()` | function | ⚠️ | Object from custom hook |

**Current Issue:** This function is used by `handleRegistrationInputChange` and needs to have stable dependencies.

### Proposed (Lines 1083–1101):
```typescript
const fetchRegistrationSuggestions = useCallback(
  async (inputValue: string) => {
    // Filter allVehicles based on input
    const query = inputValue.trim().toUpperCase()
    
    if (!query) {
      // Show all vehicles if empty
      setRegistrationSuggestions(allVehicles)
    } else {
      // Filter by registration number or customer name
      setRegistrationSuggestions(
        allVehicles.filter(
          (v) =>
            v.registrationNumber.includes(query) ||
            v.customerName.toUpperCase().includes(query)
        )
      )
    }
    dropdownNav.resetHighlight()
  },
  [allVehicles, dropdownNav]
)
```

**Callback Dependency Array:** `[allVehicles, dropdownNav]`

**Rationale:**
- `allVehicles` is state that changes, must be in dependency array
- `dropdownNav` is an object from `useDropdownKeyboardNav` hook that could change, should be in dependency array
- `setRegistrationSuggestions` is stable

---

## PART 5: useEffect at Line 406 (Keyboard & Click Handlers)

### Current (Lines 407–450):
```typescript
useEffect(() => {
  const inputElement = registrationInputRef?.current
  if (!inputElement) return

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showRegistrationSuggestions) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        dropdownNav.setHighlightedIndex((prev) =>
          prev < registrationSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        dropdownNav.setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        e.preventDefault()
        if (dropdownNav.highlightedIndex >= 0 && dropdownNav.highlightedIndex < registrationSuggestions.length) {
          handleSelectRegistrationSuggestion(registrationSuggestions[dropdownNav.highlightedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setShowRegistrationSuggestions(false)
        break
    }
  }

  const handleClickOutside = (e: MouseEvent) => {
    // Keep dropdown open if clicking inside dropdown or on input
    if (inputElement.contains(e.target as Node)) return
    if (dropdownContainerRef.current?.contains(e.target as Node)) return
    setShowRegistrationSuggestions(false)
  }

  inputElement.addEventListener("keydown", handleKeyDown)
  document.addEventListener("mousedown", handleClickOutside)

  return () => {
    inputElement.removeEventListener("keydown", handleKeyDown)
    document.removeEventListener("mousedown", handleClickOutside)
  }
}, [registrationInputRef, showRegistrationSuggestions, registrationSuggestions, dropdownNav])
```

### Issue:
When this effect runs, it calls `handleSelectRegistrationSuggestion()` but doesn't have it in the dependency array. This means:
- If `handleSelectRegistrationSuggestion` is updated by useCallback, the effect doesn't re-run
- The handler captures the OLD version of `handleSelectRegistrationSuggestion`
- **Stale closure:** User presses Enter, but old function version is called with potentially stale state

### Proposed (Lines 407–450):
```typescript
useEffect(() => {
  const inputElement = registrationInputRef?.current
  if (!inputElement) return

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showRegistrationSuggestions) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        dropdownNav.setHighlightedIndex((prev) =>
          prev < registrationSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        dropdownNav.setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        e.preventDefault()
        if (dropdownNav.highlightedIndex >= 0 && dropdownNav.highlightedIndex < registrationSuggestions.length) {
          handleSelectRegistrationSuggestion(registrationSuggestions[dropdownNav.highlightedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setShowRegistrationSuggestions(false)
        break
    }
  }

  const handleClickOutside = (e: MouseEvent) => {
    // Keep dropdown open if clicking inside dropdown or on input
    if (inputElement.contains(e.target as Node)) return
    if (dropdownContainerRef.current?.contains(e.target as Node)) return
    setShowRegistrationSuggestions(false)
  }

  inputElement.addEventListener("keydown", handleKeyDown)
  document.addEventListener("mousedown", handleClickOutside)

  return () => {
    inputElement.removeEventListener("keydown", handleKeyDown)
    document.removeEventListener("mousedown", handleClickOutside)
  }
}, [registrationInputRef, showRegistrationSuggestions, registrationSuggestions, dropdownNav, handleSelectRegistrationSuggestion])
```

**Changed Dependency Array:** Added `handleSelectRegistrationSuggestion`

**Before:** `[registrationInputRef, showRegistrationSuggestions, registrationSuggestions, dropdownNav]`

**After:** `[registrationInputRef, showRegistrationSuggestions, registrationSuggestions, dropdownNav, handleSelectRegistrationSuggestion]`

**Rationale:** 
- Now that `handleSelectRegistrationSuggestion` is wrapped with useCallback, it's a stable reference
- Adding it to the dependency array ensures the effect re-runs when the function logic changes
- This eliminates the stale closure issue

---

## PART 6: useEffect at Line 688 (External Search Input Listeners)

### Current (Lines 652–686):
```typescript
useEffect(() => {
  const inputElement = registrationInputRef?.current
  if (inputElement && searchInputRef) {
    const handleChange = (e: Event) => {
      const value = (e.target as HTMLInputElement).value
      handleRegistrationInputChange({
        target: { value: value.toUpperCase() }
      } as any)
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      dropdownNav.handleKeyDown(e as any)
    }

    const handleClick = () => {
      setShowRegistrationSuggestions(true)
      setRegistrationSuggestions(allVehicles)
      dropdownNav.resetHighlight()
    }

    inputElement.addEventListener('change', handleChange)
    inputElement.addEventListener('keydown', handleKeyDown)
    inputElement.addEventListener('click', handleClick)
    inputElement.addEventListener('focus', handleClick)

    return () => {
      inputElement.removeEventListener('change', handleChange)
      inputElement.removeEventListener('keydown', handleKeyDown)
      inputElement.removeEventListener('click', handleClick)
      inputElement.removeEventListener('focus', handleClick)
    }
  }
}, [searchInputRef, registrationInputRef, dropdownNav, allVehicles])
```

### Issue:
This effect calls `handleRegistrationInputChange()` but doesn't have it in the dependency array. When the handler is updated by useCallback, the effect doesn't re-run and the old version is captured in the closure.

### Proposed (Lines 652–686):
```typescript
useEffect(() => {
  const inputElement = registrationInputRef?.current
  if (inputElement && searchInputRef) {
    const handleChange = (e: Event) => {
      const value = (e.target as HTMLInputElement).value
      handleRegistrationInputChange({
        target: { value: value.toUpperCase() }
      } as any)
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      dropdownNav.handleKeyDown(e as any)
    }

    const handleClick = () => {
      setShowRegistrationSuggestions(true)
      setRegistrationSuggestions(allVehicles)
      dropdownNav.resetHighlight()
    }

    inputElement.addEventListener('change', handleChange)
    inputElement.addEventListener('keydown', handleKeyDown)
    inputElement.addEventListener('click', handleClick)
    inputElement.addEventListener('focus', handleClick)

    return () => {
      inputElement.removeEventListener('change', handleChange)
      inputElement.removeEventListener('keydown', handleKeyDown)
      inputElement.removeEventListener('click', handleClick)
      inputElement.removeEventListener('focus', handleClick)
    }
  }
}, [searchInputRef, registrationInputRef, dropdownNav, allVehicles, handleRegistrationInputChange])
```

**Changed Dependency Array:** Added `handleRegistrationInputChange`

**Before:** `[searchInputRef, registrationInputRef, dropdownNav, allVehicles]`

**After:** `[searchInputRef, registrationInputRef, dropdownNav, allVehicles, handleRegistrationInputChange]`

**Rationale:**
- Now that `handleRegistrationInputChange` is wrapped with useCallback, it's stable
- Adding it to the dependency array ensures the effect re-runs when the handler updates
- Eliminates stale closure when user types in the external search input

---

## PART 7: Functions That Call These Handlers

### Call Sites for `handleSelectRegistrationSuggestion`:

1. **Line 363 - Inside `dropdownNav` configuration:**
   ```typescript
   const dropdownNav = useDropdownKeyboardNav({
     itemCount: registrationSuggestions.length,
     isOpen: showRegistrationSuggestions,
     onSelect: (index) => {
       handleSelectRegistrationSuggestion(registrationSuggestions[index])
     },
     onClose: () => {
       setShowRegistrationSuggestions(false)
     },
   })
   ```
   **Status:** Does NOT need useCallback wrapping because the `onSelect` callback is a local inline arrow function created inside the effect. Each re-render creates a new one. The `useDropdownKeyboardNav` hook manages this.

2. **Line 427 - Inside useEffect at line 407:**
   ```typescript
   handleSelectRegistrationSuggestion(registrationSuggestions[dropdownNav.highlightedIndex])
   ```
   **Status:** Will be automatically fixed by wrapping `handleSelectRegistrationSuggestion` with useCallback.

3. **Line 1745 - JSX onClick handler:**
   ```typescript
   <button
     onClick={() => handleSelectRegistrationSuggestion(suggestion)}
     ...
   >
   ```
   **Status:** Does NOT need useCallback wrapping because it's an inline arrow function in JSX. The onClick itself is fine—the wrapped `handleSelectRegistrationSuggestion` is what matters.

### Call Sites for `handleRegistrationInputChange`:

1. **Line 659 - Inside useEffect at line 688:**
   ```typescript
   handleRegistrationInputChange({
     target: { value: value.toUpperCase() }
   } as any)
   ```
   **Status:** Will be automatically fixed by wrapping `handleRegistrationInputChange` with useCallback.

### Conclusion:
**No other functions need useCallback wrapping as a result of these changes.** The two handler functions themselves are sufficient—their call sites either use them correctly or are part of the effects we're already fixing.

---

## Summary of Changes

### Files to Edit:
- **`components/dashboard/update-job-card-form.tsx`**

### Changes Required:

1. ✅ **Line 2:** Add `useCallback` to React imports
2. ✅ **Lines 1083–1101:** Wrap `fetchRegistrationSuggestions` with useCallback, dependency array: `[allVehicles, dropdownNav]`
3. ✅ **Lines 1103–1129:** Wrap `handleRegistrationInputChange` with useCallback, dependency array: `[fetchRegistrationSuggestions]`
4. ✅ **Lines 1130–1183:** Wrap `handleSelectRegistrationSuggestion` with useCallback, dependency array: `[isSelectingSuggestion, loadJobCard]`
5. ✅ **Line 450:** Add `handleSelectRegistrationSuggestion` to useEffect dependency array (line 407)
6. ✅ **Line 686:** Add `handleRegistrationInputChange` to useEffect dependency array (line 688)

### Total Edits: 6 changes across 2 functions + 2 useEffects + imports

### Testing Plan After Implementation:
1. ✅ Build the project and verify no TypeScript errors
2. ✅ Manually test vehicle selection via keyboard (Enter key in dropdown)
3. ✅ Manually test vehicle selection via mouse click on dropdown item
4. ✅ Manually test typing in the registration number input
5. ✅ Manually test typing in external search input (if present)
6. ✅ Verify no infinite loops or excessive re-renders in React DevTools
7. ✅ Check console for any warnings or errors

---

## Risk Assessment

**Risk Level: LOW**

- All changes are contained to one file
- Changes preserve all existing functionality—no logic is modified
- Dependencies are correctly identified and dependencies arrays are valid
- useCallback pattern is well-established in React

**Potential Issues:**
- None identified. This is a straightforward fix to eliminate stale closures and provide proper dependency tracking.


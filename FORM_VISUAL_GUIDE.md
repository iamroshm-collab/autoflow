# 📸 New JobCard Form - Visual Walkthrough

## Form Layout Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    New Job Card Form                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Row 1: Input Fields                                            │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Mobile Number *     │  │ Registration # * │  │ KM Driven  │ │
│  │ [Search field] ▼    │  │ [Dropdown] ▼     │  │ [Input]    │ │
│  └─────────────────────┘  └──────────────────┘  └────────────┘ │
│   └─ Search dropdown         └─ Vehicle list     └─ Optional   │
│      shows matches              + Add New                       │
│                                                                  │
│  Row 2: Auto-populated Fields                                  │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Customer Name       │  │ Date *           │  │ File No    │ │
│  │ [Auto-filled]       │  │ [Date Picker] ▼  │  │ [Input]    │ │
│  └─────────────────────┘  └──────────────────┘  └────────────┘ │
│   └─ Read-only           └─ Default: today    └─ Optional    │
│                                                                  │
│  Row 3: System Generated Fields                                │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Vehicle Model       │  │ JobCard Number   │  │ Status *   │ │
│  │ [Auto-filled]       │  │ [JC-AL-2026...] │  │ [Dropdown] │ │
│  └─────────────────────┘  └──────────────────┘  └────────────┘ │
│   └─ Read-only           └─ Auto-generated     └─ Default: US │
│                                                                  │
│  Row 4: Action Buttons                                         │
│  ┌──────────────────────────────┐  ┌─────────────────────────┐ │
│  │   [Save JobCard] (Primary)   │  │   [Cancel] (Secondary)  │ │
│  └──────────────────────────────┘  └─────────────────────────┘ │
│   └─ Saves to database              └─ Discards changes      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Step-by-Step User Flow

### Step 1️⃣: Enter Mobile Number

```
User Action: Type mobile number in search field
┌─────────────────────────────────────┐
│ Mobile Number *                      │
│ [999] ← User typing               │
│                                     │
│ Search starts after 3 characters   │
│ API searches: GET /api/customers   │
└─────────────────────────────────────┘

If Found:
┌─────────────────────────────────────┐
│ Mobile Number *                      │
│ [9999999999]                       │
│ ┌─────────────────────────────────┐ │
│ │ 9999999999 - John Doe         │ │ ← Select
│ │ 9999000000 - Jane Smith       │ │
│ │ 9999111111 - Bob Wilson       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

If NOT Found:
┌─────────────────────────────────────┐
│ Mobile Number *                      │
│ [9999999999]                       │
│                                     │
│ After blur/leaving field:           │
│ ┌───────────────────────────────┐   │
│ │ 🔔 Customer Not Found         │   │
│ │ Customer with this mobile #   │   │
│ │ doesn't exist. Create new?    │   │
│ │                               │   │
│ │ [Cancel]  [Create Customer] ←─┼─ Triggers Modal
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Step 2️⃣: Create New Customer (If Needed)

```
Modal: Add New Customer
┌──────────────────────────────────────┐
│ ✕ Add New Customer                   │
├──────────────────────────────────────┤
│                                      │
│ Mobile Number (Read-only)            │
│ [9999999999]                        │
│                                      │
│ Customer Name * (Required)          │
│ [John Doe_____________________]    │
│                                      │
│ Email (Optional)                     │
│ [john@example.com_____________]    │
│                                      │
│ Address                              │
│ [123 Main Street______________]    │
│                                      │
│ City      │ State     │ Pincode      │
│ [BLR___]  │ [KA____] │ [560001____] │
│                                      │
│           [Cancel]  [Create] →      │
│                                      │
└──────────────────────────────────────┘

After Save:
- Customer created in database
- Form auto-selects new customer
- Modal closes
- Vehicle dropdown loads
```

### Step 3️⃣: Select Vehicle

```
After Customer Selected:
┌────────────────────────────────────┐
│ Registration Number *               │
│ [Click to view vehicles] ▼         │
│ ┌──────────────────────────────┐   │
│ │ KA-01-AB-1234 (Maruti Swift)│ ← Select
│ │ KA-01-CD-5678 (Honda City)  │
│ │ KA-01-EF-9999 (Toyota Innova)   │
│ │ ────────────────────────────│   │
│ │ + Add New Vehicle           │ ← Click to add new
│ └──────────────────────────────┘   │
└────────────────────────────────────┘

After Vehicle Selected:
┌────────────────────────────────────┐
│ Registration Number *               │
│ [KA-01-AB-1234_______________]    │
└────────────────────────────────────┘

Auto-populated:
┌────────────────────────────────────┐
│ Vehicle Model (Read-only)           │
│ [Maruti Swift________________]    │
└────────────────────────────────────┘

Fetches New JobCard Number:
┌────────────────────────────────────┐
│ JobCard Number (Read-only)          │
│ [JC-AL-2026-0001______________]   │
└────────────────────────────────────┘
```

### Step 4️⃣: Add New Vehicle (If Needed)

```
Modal: Add New Vehicle
┌──────────────────────────────────────┐
│ ✕ Add New Vehicle                    │
├──────────────────────────────────────┤
│                                      │
│ Registration Number * (Required)     │
│ [KA-01-AB-1234_________________]   │
│                                      │
│ Make *            │ Model *          │
│ [Maruti_____]     │ [Swift_____]    │
│                                      │
│ Year              │ Color            │
│ [2023_____]       │ [Red_______]    │
│                                      │
│           [Cancel]  [Add] →         │
│                                      │
└──────────────────────────────────────┘

After Vehicle Added:
- Vehicle saved to database
- Form updates dropdown
- New vehicle auto-selected
- Vehicle model auto-populates
```

### Step 5️⃣: Review Form

```
Complete Form with All Fields Filled:

Row 1:
┌─────────────────┐  ┌──────────────┐  ┌──────────┐
│ 9999999999      │  │ KA-01-AB-1234│  │ 50000    │
└─────────────────┘  └──────────────┘  └──────────┘

Row 2:
┌─────────────────┐  ┌──────────────┐  ┌──────────┐
│ John Doe        │  │ 2026-02-16   │  │ FILE-001 │
│ (Read-only)     │  │ (Editable)   │  │ (Opt)    │
└─────────────────┘  └──────────────┘  └──────────┘

Row 3:
┌─────────────────┐  ┌──────────────┐  ┌──────────┐
│ Maruti Swift    │  │ JC-AL-2026...│  │ Under Svc│
│ (Read-only)     │  │ (Auto-gen)   │  │ (Status) │
└─────────────────┘  └──────────────┘  └──────────┘

Row 4:
┌────────────────────────────────────┐
│ [Save JobCard] (Blue, Enabled)     │
│ [Cancel] (Gray outline)            │
└────────────────────────────────────┘
```

### Step 6️⃣: Save JobCard

```
User clicks "Save JobCard"

Validation Checks:
✓ Mobile Number & Customer selected?  → YES
✓ Registration Number & Vehicle sel?  → YES
✓ All required fields filled?         → YES

If ANY validation fails:
┌──────────────────────────────────┐
│ 🔔 Error                         │
│ Required fields are empty.       │
│ Please fill them before saving.  │
│ [OK]                             │
└──────────────────────────────────┘

If PASSES validation:
↓ POST /api/jobcards with data
↓ Database stores JobCard
↓ Success toast appears

┌────────────────────────────────────┐
│ ✓ JobCard created successfully!    │ (Green toast)
└────────────────────────────────────┘

↓ Form resets
↓ New JobCard number fetched
↓ Ready for next entry
```

## Modal Dialogs

### Customer Not Found Alert
```
┌──────────────────────────────────────┐
│ ⚠️ Customer Not Found                │
├──────────────────────────────────────┤
│                                      │
│ Customer with mobile number          │
│ 9999999999 does not exist in the    │
│ database. Would you like to create  │
│ a new customer?                      │
│                                      │
│ [Cancel]           [Create Customer] │
│                                      │
└──────────────────────────────────────┘
```

### Add Customer Modal
```
┌──────────────────────────────────────┐
│ ✕ Add New Customer                   │
├──────────────────────────────────────┤
│ Customer not found. Please create a  │
│ new customer record.                 │
├──────────────────────────────────────┤
│                                      │
│ Mobile Number * (Disabled)           │
│ [9999999999]                        │
│                                      │
│ Customer Name * (Required)          │
│ [ ] ← Focus here for tab order      │
│                                      │
│ Email                                │
│ [ ]                                  │
│                                      │
│ Address                              │
│ [ ]                                  │
│                                      │
│ City  State  Pincode                │
│ [ ]   [ ]    [ ]                     │
│                                      │
│ [Cancel]      [Create Customer] →   │
│                                      │
└──────────────────────────────────────┘
```

### Add Vehicle Modal
```
┌──────────────────────────────────────┐
│ ✕ Add New Vehicle                    │
├──────────────────────────────────────┤
│ Add a new vehicle for the selected  │
│ customer.                            │
├──────────────────────────────────────┤
│                                      │
│ Registration Number * (Required)     │
│ [ ]                                  │
│                                      │
│ Make *          │  Model *          │
│ [ ]             │  [ ]              │
│                                      │
│ Year            │  Color            │
│ [ ]             │  [ ]              │
│                                      │
│ [Cancel]        [Add Vehicle] →     │
│                                      │
└──────────────────────────────────────┘
```

## Toast Notifications

### Success Toast
```
┌─────────────────────────────────────┐ (Green background)
│ ✓ JobCard created successfully!     │
└─────────────────────────────────────┘
(Auto-dismisses after 3 seconds)
```

### Error Toast
```
┌─────────────────────────────────────┐ (Red background)
│ ✗ Failed to fetch customers         │
└─────────────────────────────────────┘
(Auto-dismisses after 3 seconds)
```

### Validation Error Toast
```
┌─────────────────────────────────────┐ (Orange background)
│ ⚠️ Required fields are empty        │
│ Please fill them before saving.     │
└─────────────────────────────────────┘
(Auto-dismisses after 3 seconds)
```

## Unsaved Changes Warning

```
When user tries to navigate away WITH unsaved changes:

Browser Default Warning:
┌──────────────────────────────────────┐
│ "Are you sure you want to leave?    │
│  Changes you made may not be saved." │
│                                      │
│ [Cancel]          [Leave Page]       │
└──────────────────────────────────────┘

NOTE: The exact wording varies by browser (Chrome, Firefox, Safari, Edge)
This is a native browser feature, not a custom dialog.
```

## Responsive Design

### Desktop (3-Column Layout)
```
Wide Screen (1024px+):
┌──────────────────────────────────────────────────────────┐
│ [Mobile #]  [Registration #]  [KM Driven]               │
│ [Cust Name] [Date]            [File No]                 │
│ [Vehicle]   [JobCard #]       [Status]                  │
│ [Save Button] [Cancel Button]                           │
└──────────────────────────────────────────────────────────┘
```

### Tablet (2-Column Layout)
```
Medium Screen (640px - 1023px):
┌────────────────────────────────┐
│ [Mobile #]  [Registration #]   │
│ [KM Driven]                    │
│ [Cust Name] [Date]             │
│ [File No]                      │
│ [Vehicle]   [JobCard #]        │
│ [Status]                       │
│ [Save]  [Cancel]               │
└────────────────────────────────┘
```

### Mobile (1-Column Layout)
```
Small Screen (<640px):
┌──────────────────────┐
│ [Mobile #]           │
│ [Registration #]     │
│ [KM Driven]          │
│ [Cust Name]          │
│ [Date]               │
│ [File No]            │
│ [Vehicle]            │
│ [JobCard #]          │
│ [Status]             │
│ [Save]               │
│ [Cancel]             │
└──────────────────────┘
```

## Field States

### Normal State
```
┌─────────────────────────────┐
│ Label *                     │
│ [  Input field ready    ]   │ → Outline border, white bg
└─────────────────────────────┘
```

### Focused State
```
┌─────────────────────────────┐
│ Label *                     │
│ [  Input field focused  ] ⃝ │ → Blue outline, focus ring
└─────────────────────────────┘
```

### Filled State
```
┌─────────────────────────────┐
│ Label *                     │
│ [ Filled value_________ ]   │ → Standard outline
└─────────────────────────────┘
```

### Disabled State
```
┌─────────────────────────────┐
│ Label                       │
│ [  Disabled field    ]      │ → Gray bg, no interactions
└─────────────────────────────┘
```

### Loading State
```
┌─────────────────────────────┐
│ Label *                     │
│ [ Loading... ⏳ ]            │ → Gray text with spinner
└─────────────────────────────┘
```

### Error State
```
┌─────────────────────────────┐
│ Label * ⚠️ Error message    │
│ [ Validation failed ]       │ → Red border, error text
└─────────────────────────────┘
```

## Keyboard Navigation

```
Tab Order (Natural Flow):
1. Mobile Number input
2. Registration Number button/dropdown
3. KM Driven input
4. Customer Name (skip - disabled)
5. Date input
6. File No input
7. Vehicle Model (skip - disabled)
8. JobCard Number (skip - disabled)
9. Status dropdown
10. Save Button
11. Cancel Button

Enter/Space: Triggers dropdowns and buttons
Escape: Closes dropdowns
Arrow Keys: Navigate in dropdowns
```

---

## Color Scheme

- **Primary**: Blue - Active buttons, focus states
- **Success**: Green - Success toasts, checkmarks
- **Warning**: Orange - Warning toasts
- **Error**: Red - Error toasts, validation errors
- **Disabled**: Gray - Disabled fields, inactive buttons
- **Text**: Black/Dark Gray - Main content
- **Muted**: Light Gray - Placeholder text, disabled text
- **Background**: White - Form background
- **Border**: Light Gray - Field borders

---

**User Experience**: Smooth, intuitive, and professional  
**Accessibility**: Keyboard navigable, screen reader friendly  
**Responsiveness**: Works seamlessly on all devices

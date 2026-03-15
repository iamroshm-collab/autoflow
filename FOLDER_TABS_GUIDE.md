# Folder Tab Component Usage Guide

## Overview
A responsive folder-tab component implementing the classic folder-tab metaphor with:
- ✅ Active tabs with white background, no bottom border, connected to content
- ✅ Inactive tabs with colored background (blue) and white text
- ✅ 4px border-radius on top corners
- ✅ Smooth hover transitions
- ✅ Fully responsive design

---

## React/Tailwind Implementation

### Quick Start

```tsx
import FolderTabs, { FolderTabItem } from '@/components/ui/folder-tabs'

export default function MyPage() {
  const tabs: FolderTabItem[] = [
    {
      value: 'attendance',
      label: 'Attendance',
      content: <AttendanceForm />,
    },
    {
      value: 'payroll',
      label: 'Payroll',
      content: <PayrollForm />,
    },
  ]

  return (
    <FolderTabs 
      items={tabs} 
      defaultValue="attendance"
      accentClass="bg-blue-600" // Customize inactive tab color
    />
  )
}
```

### Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `FolderTabItem[]` | **required** | Array of tab definitions |
| `defaultValue` | `string` | First tab value | Initially active tab |
| `accentClass` | `string` | `'bg-blue-600'` | Tailwind background class for inactive tabs |
| `className` | `string` | `''` | Additional CSS classes |

### FolderTabItem Type

```tsx
type FolderTabItem = {
  value: string          // Unique identifier
  label: React.ReactNode // Tab label (can include icons)
  content: React.ReactNode // Tab panel content
}
```

### Examples

#### With Icons
```tsx
import { Calendar, DollarSign } from 'lucide-react'

const tabs: FolderTabItem[] = [
  {
    value: 'attendance',
    label: (
      <span className="flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Attendance
      </span>
    ),
    content: <AttendanceForm />,
  },
]
```

#### Custom Color Scheme
```tsx
// Green theme for inactive tabs
<FolderTabs items={tabs} accentClass="bg-emerald-600" />

// Purple theme
<FolderTabs items={tabs} accentClass="bg-purple-600" />

// Red theme
<FolderTabs items={tabs} accentClass="bg-red-600" />
```

#### Multiple Tabs
```tsx
const tabs = [
  { value: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
  { value: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
  { value: 'tab3', label: 'Tab 3', content: <div>Content 3</div> },
  { value: 'tab4', label: 'Tab 4', content: <div>Content 4</div> },
]
```

---

## HTML/CSS Implementation

### Files Location
- **Demo**: `public/folder-tabs-example.html`
- Open directly in browser to see the component in action

### HTML Structure
```html
<div class="folder-tabs">
  <!-- Tab Navigation -->
  <div class="tabs-nav">
    <button class="tab-button active" onclick="switchTab(event, 'tab1')">
      Tab 1
    </button>
    <button class="tab-button" onclick="switchTab(event, 'tab2')">
      Tab 2
    </button>
  </div>

  <!-- Tab Content -->
  <div id="tab1" class="tab-content active">
    <!-- Content for tab 1 -->
  </div>
  
  <div id="tab2" class="tab-content">
    <!-- Content for tab 2 -->
  </div>
</div>
```

### JavaScript
```javascript
function switchTab(event, tabId) {
  // Remove active class from all tabs and content
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(btn => btn.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));
  
  // Add active class to clicked tab and corresponding content
  event.currentTarget.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}
```

### Customizing Colors

Change the inactive tab background color in CSS:
```css
.tab-button {
  background: #2563eb; /* Default blue */
}

/* Or use other colors */
.tab-button {
  background: #059669; /* Green */
  background: #7c3aed; /* Purple */
  background: #dc2626; /* Red */
}
```

---

## Design Features

### Classic Folder-Tab Metaphor
- **Active Tab**: White background appears to be part of the content area
- **Inactive Tabs**: Colored background (blue by default) stands back visually
- **No Bottom Border**: Active tab seamlessly connects to content below
- **Rounded Top Corners**: 4px border-radius creates the folder shape

### Responsive Behavior
- **Desktop**: Tabs display horizontally with proper spacing
- **Mobile**: Tabs wrap or stack as needed
- **Touch-Friendly**: Adequate padding for touch targets

### Accessibility
- **Keyboard Navigation**: Full keyboard support with focus indicators
- **ARIA Attributes**: Proper role, aria-selected, and aria-controls
- **Focus Visible**: Clear focus ring for keyboard users

---

## Integration Examples

### Use in Existing Attendance/Payroll Module

See complete example in:
`components/dashboard/attendance-payroll-tabs-example.tsx`

### Use in Any Page
```tsx
import AttendancePayrollTabs from '@/components/dashboard/attendance-payroll-tabs-example'

export default function AttendancePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Attendance & Payroll</h1>
      <AttendancePayrollTabs />
    </div>
  )
}
```

---

## Styling Customization

### Custom Border Color
```tsx
// In folder-tabs.tsx, modify border colors:
className="border border-purple-300" // Change from border-gray-300
```

### Custom Active Tab Style
```tsx
// Add your own data-[state=active] modifiers:
'data-[state=active]:bg-gradient-to-b data-[state=active]:from-white data-[state=active]:to-gray-50'
```

### Larger Tabs
```tsx
// Increase padding:
'px-8 py-4' // Instead of default px-6 py-3
```

---

## Troubleshooting

### Tabs Not Switching
- Ensure each tab has a unique `value`
- Check that `defaultValue` matches one of the tab values

### Styling Issues
- Make sure Tailwind CSS is properly configured
- Check that required UI components are installed (shadcn/ui)

### Active Tab Not Connected
- Verify `-mb-px` (negative margin) is applied to tab buttons
- Ensure `border-b-white` is set on active tab
- Check that content has `border-t-0`

---

## Files Reference

1. **Component**: `components/ui/folder-tabs.tsx`
2. **Example Usage**: `components/dashboard/attendance-payroll-tabs-example.tsx`
3. **HTML Demo**: `public/folder-tabs-example.html`
4. **This Guide**: `FOLDER_TABS_GUIDE.md`

---

## Browser Support
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

---

## Credits
Based on classic folder-tab UI pattern with modern accessibility and responsive design.

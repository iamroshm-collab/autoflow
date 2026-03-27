# 🧪 Manual Testing Checklist — AutoFlow Garage Management System

**Last Updated:** March 25, 2026  
**Build Status:** ✅ Production Ready (v16.1.6 Next.js, Compiled 24.6s)

> This checklist covers all major features and user flows. Focus on verifying functionality works correctly after recent performance optimizations (useCallback wrappers on 8 critical functions).

---

## 🔐 SECTION 1: AUTHENTICATION & ACCESS CONTROL

### 1.1 Login — Mobile + OTP Flow
**Route:** `/login`  
**Key Interaction:** Mobile number entry → OTP request → OTP verification → Session creation

- [ ] **Test: Valid Mobile Login**
  - Enter valid 10-digit mobile number
  - Verify "Get OTP" button enables
  - Click "Get OTP"
  - **Passing Result:** OTP sent message appears, OTP input field becomes active
  - **Risk:** None from recent changes

- [ ] **Test: Invalid Mobile Rejection**
  - Enter invalid mobile (5 digits, letters, +1 format)
  - Verify error message: "Invalid mobile number format"
  - Try submitting without OTP field filled
  - **Passing Result:** Form prevents submission

- [ ] **Test: OTP Verification**
  - Complete mobile entry + OTP request flow
  - Wait for OTP (or use test OTP if provided)
  - Enter OTP
  - Click "Verify"
  - **Passing Result:** Redirects to appropriate dashboard (admin/manager/technician)

- [ ] **Test: Device Approval Flow**
  - Login from new device
  - If device approval required, should show "Waiting for approval" message
  - **Passing Result:** Message displayed until admin approves device

---

### 1.2 Register — New User Flow
**Route:** `/register`  
**Key Interaction:** Mobile OTP → Name/Address/Details → Account creation

- [ ] **Test: Register New User**
  - Navigate to Register page
  - Enter mobile number
  - Request OTP
  - Enter OTP
  - Fill all required fields: Name, Address (line 1, city, state, postal code)
  - Submit registration
  - **Passing Result:** Success message, redirected to complete profile or dashboard

- [ ] **Test: Duplicate Mobile Prevention**
  - Try registering with existing mobile number
  - **Passing Result:** Error message "Mobile already registered"

- [ ] **Test: Address Composition**
  - Fill multi-line address (line1, line2, city, district, state, postal code)
  - Submit
  - Navigate back to profile
  - **Passing Result:** Address properly composed and displays correctly

---

### 1.3 Admin Bootstrap (Initial Setup)
**Route:** `/dev/admin-bootstrap`  
**Key Interaction:** Create first admin user if none exists

- [ ] **Test: Initial Admin Creation**
  - If app fresh (no admins), navigate to bootstrap page
  - Fill name and mobile
  - Click "Create Admin"
  - **Passing Result:** Admin user created, can login with mobile + OTP

- [ ] **Test: Bootstrap Lock**
  - After first admin created, try creating another
  - **Passing Result:** Page shows "Bootstrap already completed" or similar lock message

---

## 📊 SECTION 2: MAIN DASHBOARD & NAVIGATION

### 2.1 Dashboard Main Page
**Route:** `/` (after login)  
**Key Interactions:** Sidebar navigation, form selection, job card listing

- [ ] **Test: Dashboard Loads**
  - Login successfully
  - Main dashboard should display
  - Sidebar visible with menu options
  - **Passing Result:** No errors, page responsive

- [ ] **Test: Sidebar Navigation**
  - Verify all menu items visible:
    - Dashboard (home icon)
    - New Job Card
    - Job Card Statuses
    - Technician Tasks
    - Inventory & POS
    - Attendance & Payroll
    - Settings
  - Click each menu item
  - **Passing Result:** Correct form/section loads for each

- [ ] **Test: Search Functionality**
  - In main dashboard, search for existing job card by number/registration
  - Results should display
  - Click on result
  - **Passing Result:** Job card loads correctly

- [ ] **Test: Navigation Between Records** ⚠️ **KNOWN CHANGE: useCallback on handleNavigatePrevious/handleNavigateNext**
  - Load a job card
  - If navigation buttons visible, click Previous/Next
  - **Passing Result:** Correctly navigates to prev/next card without lag
  - **Risk Monitor:** Watch for stale state or incorrect card loading

---

## 📋 SECTION 3: JOB CARD MANAGEMENT

### 3.1 Create New Job Card
**Route:** `/` → "New Job Card" form  
**Component:** NewJobCardForm  
**Key Interactions:** Customer lookup → Vehicle lookup → Job card details → Save

- [ ] **Test: Search Existing Customer**
  - Click "New Job Card"
  - Enter mobile number of existing customer
  - Customer suggestions should appear
  - Click one
  - **Passing Result:** Customer name and vehicle history populate

- [ ] **Test: Create New Customer**
  - Enter mobile + customer name (new combo)
  - No results should show
  - Click "Add New Customer" modal
  - Fill address, designation (optional)
  - Save customer
  - **Passing Result:** Customer created and selected, can proceed to vehicle

- [ ] **Test: Search Existing Vehicle**
  - After customer selected, in registration field
  - Enter partial registration (e.g., "KA")
  - Matching vehicles should autocomplete
  - Select one
  - **Passing Result:** Vehicle details populate (make, model, year, color)

- [ ] **Test: Create New Vehicle**
  - Enter registration not matching any existing vehicle
  - Click "Add New Vehicle" modal
  - Select make, model (with API autocomplete)
  - Enter color, year
  - Save vehicle
  - **Passing Result:** Vehicle created and selected

- [ ] **Test: Complete Job Card Form**
  - Fill: Job date (date picker), File No., KM Driven, Job Card Status
  - Verify all required fields have values
  - Click "Save Job Card"
  - **Passing Result:** Job card created, unique job card number assigned
  - **Risk Monitor:** Recent useCallback on openAttendanceRowEditor shouldn't affect this, but watch for form lag

- [ ] **Test: Unsaved Changes Warning**
  - Start filling job card form
  - Try to navigate away (browser back button or sidebar)
  - **Passing Result:** Confirmation dialog appears: "You have unsaved changes"

- [ ] **Test: Form Overflow & Scrolling**
  - On smaller screens, form should scroll properly
  - All fields accessible
  - **Passing Result:** No field cut off, layout responsive

---

### 3.2 Update Job Card
**Route:** `/` → Find existing job card → Click to edit  
**Component:** UpdateJobCardForm  
**Key Interactions:** Edit services, technician allocation, spare parts, billing

- [ ] **Test: Load Existing Job Card**
  - Navigate to job card list
  - Click on any "Under Service" job card
  - Form should load with existing data
  - **Passing Result:** All fields pre-populated correctly

- [ ] **Test: Add Service Descriptions**
  - In Services table, click + button
  - Add new row: description, unit, quantity, amount
  - Set GST rates (CGST, SGST or IGST)
  - **Passing Result:** Row added, amounts calculated, tax/GST auto-computed

- [ ] **Test: Allocate Technician**
  - In Technician Allocation table, add row
  - Search and select technician by name
  - Set work type, task assigned, allocation amount
  - **Passing Result:** Technician added, row displays correctly

- [ ] **Test: Add Spare Parts**
  - In Spare Parts table, click + button
  - Search shop from dropdown autocomplete
  - Enter bill date (date picker), bill number, item, amount
  - **Passing Result:** Spare part row created, amount updates total billing

- [ ] **Test: Date Picker in Spare Parts**
  - Click date picker in spare part row
  - Calendar should popup
  - Select date
  - Date should populate field and persist
  - **Passing Result:** Date format correct (dd-mm-yy), value saved

- [ ] **Test: Financial Transaction Entry** ⚠️ **USES useCallback indirectly**
  - Add financial transaction (advance, payment, discount)
  - Fill fields: type, date, payment method, amount
  - **Passing Result:** Transaction rows add/remove smoothly without lag

- [ ] **Test: Calculate Totals**
  - Enter services, spare parts, technician amounts
  - Subtotal, tax, discount, final amount should auto-compute
  - **Passing Result:** Math correct, all amounts visible

- [ ] **Test: Update Job Card Status**
  - In status dropdown, change from "Under Service" to "Ready for Delivery"
  - Fill delivery date
  - Submit
  - **Passing Result:** Status updated, job card moves to delivery workflow

- [ ] **Test: Delete Row (Services/Parts/Technicians)**
  - Click trash icon on any row
  - Confirm deletion if prompted
  - **Passing Result:** Row removed, totals recalculate

---

### 3.3 Ready for Delivery
**Route:** `/` → Delivery Status section  
**Key Interactions:** Final billing review, print invoice, mark delivered

- [ ] **Test: Load Delivery Job Cards**
  - Filter for "Ready for Delivery" job cards
  - List should show only those status cards
  - **Passing Result:** Correct filter applied

- [ ] **Test: Print Job Card Invoice**
  - Open job card ready for delivery
  - Click "Print" button
  - **Passing Result:** PDF generated with job card details, billing

- [ ] **Test: Mark as Delivered**
  - In delivery form, click "Mark Delivered" button
  - Should prompt for delivery date
  - Submit
  - **Passing Result:** Job card moved to "Delivered" status, no longer in ready list

---

## 👥 SECTION 4: EMPLOYEE MASTER & HR

### 4.1 Employee Master Form
**Route:** `/` → Dashboard → "Employees" (from sidebar)  
**Component:** EmployeeMasterForm  
**Key Interactions:** List, create, update, delete employees

- [ ] **Test: Load Employee List**
  - Navigate to Employee Master
  - List of employees should display in table
  - Columns: Name, ID, Mobile, Designation, Salary/day, Actions
  - **Passing Result:** Data loads without errors

- [ ] **Test: Search Employees** 
  - In search box, type employee name or ID number
  - Table should filter in real-time
  - **Passing Result:** Correct records displayed

- [ ] **Test: Add New Employee** ⚠️ **HIGH CHANGE: useCallback on handleAddNew()**
  - Click "+ Add New Employee" button
  - Modal should open with blank form
  - Test rapid clicking multiple times (10+ times)
  - **Passing Result:** Modal opens smoothly, no duplicate openings, no lag
  - **Risk Monitor:** Watch for form not resetting properly or modal lag

- [ ] **Test: Create Employee Record**
  - Fill required fields: Name, ID Number, Mobile
  - Fill optional: Address (lines, city, district, state, postal code), Designation, Salary
  - Set toggles: Attendance Eligible, Is Technician
  - Click "Save Employee"
  - **Passing Result:** Employee created, added to list
  - **Risk Monitor:** Modal should close automatically after save

- [ ] **Test: Mobile Validation**
  - Fill form with invalid mobile (5 digits, "+1" format, etc.)
  - Try to save
  - **Passing Result:** Error message prevents save: "Invalid mobile number format"

- [ ] **Test: Edit Employee** ⚠️ **HIGH CHANGE: useCallback on handleSave()**
  - Click edit (pencil icon) on any employee
  - Modal should open with data pre-loaded
  - Change one field (e.g., salary, designation)
  - Click "Save Employee"
  - **Passing Result:** Employee updated, list reflects change
  - **Risk Monitor:** Verify save doesn't accidentally save form state from different employee

- [ ] **Test: Photo Upload**
  - While editing employee, click photo upload
  - Select a face image file
  - Photo should preview
  - Save employee
  - **Passing Result:** Photo saved and displays in employee record

- [ ] **Test: Delete Employee from Table** ⚠️ **HIGH CHANGE: useCallback on handleDeleteFromList()**
  - In employee list, click trash icon on multiple rows (15+ times)
  - For each, confirm deletion
  - No lag between deletions
  - Modal shouldn't interfere with deletions
  - **Passing Result:** Employees removed smoothly, list updates
  - **Risk Monitor:** Watch for performance degradation after many deletes

- [ ] **Test: Modal Open/Close** ⚠️ **MEDIUM CHANGE: useCallback on handleModalOpenChange()**
  - Open modal with Add New or Edit
  - Close modal by clicking X
  - Form should reset to default when closed
  - Re-open another employee
  - **Passing Result:** New employee data loads, old data not visible
  - **Risk Monitor:** Watch that closing and reopening doesn't show stale data

- [ ] **Test: Technician Toggle**
  - Create/edit employee
  - Toggle "Is Technician" ON
  - If designation is "Admin", should auto-disable "Attendance Eligible"
  - **Passing Result:** Conditional logic works correctly

---

## ⏰ SECTION 5: ATTENDANCE & PAYROLL

### 5.1 Attendance Tab
**Route:** `/attendance-payroll` → Attendance Tab  
**Component:** AttendancePayrollModule  
**Key Interactions:** Date picker, fetch records, edit attendance, mark present/half/absent

- [ ] **Test: Load Attendance for Date** ⚠️ **MEDIUM CHANGE: useCallback on fetchAttendance()**
  - Navigate to Attendance tab
  - Select a date using date picker
  - Attendance records for that date should load in table
  - **Passing Result:** Table populates with employee records
  - **Risk Monitor:** Verify no stale data from previous date selection

- [ ] **Test: Date Picker Rapid Changes** ⚠️ **MEDIUM CHANGE: fetchAttendance depends on attendanceDate**
  - Click date picker
  - Rapidly click backward 5-10 dates
  - For each date, records should fetch
  - **Passing Result:** Latest date records always correct, no missed updates
  - **Risk Monitor:** Watch for network requests piling up or old data showing

- [ ] **Test: Edit Attendance Row** ⚠️ **HIGH CHANGE: useCallback on openAttendanceRowEditor()**
  - In attendance table, click edit icon on row
  - Edit modal should open with fields:
    - Attendance status (P/H/A select)
    - Check-in time
    - Check-out time
    - Worked minutes
  - Edit fields, save
  - **Passing Result:** Modal closes, row updates in table, list refreshes
  - **Risk Monitor:** Rapid editing (20+ rows) should not lag or show wrong data

- [ ] **Test: Mark Attendance Status**
  - Edit a row, change attendance from P to H (half day)
  - Save
  - Row should show new status
  - **Passing Result:** Status persists

- [ ] **Test: Tab Navigation**
  - While editing attendance, switch to "Adjustments" tab
  - Return to "Attendance" tab
  - Attendance data should refresh
  - **Passing Result:** Fresh data loaded, not cached state

---

### 5.2 Adjustments Tab
**Route:** `/attendance-payroll` → Adjustments Tab  
**Key Interactions:** Add salary adjustments (bonus, deduction, allowance)

- [ ] **Test: Load Adjustments**
  - Navigate to Adjustments tab
  - List of salary adjustments should display
  - **Passing Result:** Data loads

- [ ] **Test: Add New Adjustment**
  - Click "+ Add Adjustment" button
  - Modal opens, fill fields:
    - Employee (dropdown autocomplete)
    - Adjustment Type (Allowance/Deduction/etc.)
    - Amount
    - Date
    - Remarks (optional)
  - Save
  - **Passing Result:** Adjustment added to list

---

### 5.3 Payroll Tab
**Route:** `/attendance-payroll` → Payroll Tab  
**Key Interactions:** Generate payroll, print salary slips

- [ ] **Test: Load Payroll**
  - Navigate to Payroll tab
  - Select month/year (date picker elements)
  - Payroll records should display
  - **Passing Result:** Correct calculations shown

- [ ] **Test: Generate Salary Slip PDF**
  - Click "Print" or "Salary Slip" button on payroll record
  - **Passing Result:** PDF downloads with employee details, amounts, taxes

---

## 📦 SECTION 6: INVENTORY & POS MANAGEMENT

### 6.1 Inventory & POS Page
**Route:** `/inventory-pos`  
**Key Interactions:** Tabs for Purchase Entry, POS Sales, Movement, Reports

- [ ] **Test: Purchase Entry Tab**
  - Navigate to Inventory & POS
  - Click "Purchase" tab
  - Modal for new purchase, fields should appear:
    - Supplier (dropdown)
    - Purchase Date (date picker)
    - Bill Number
    - Product rows (product name, quantity, unit price)
  - Add 2-3 product rows
  - Save purchase
  - **Passing Result:** Purchase created, visible in list

- [ ] **Test: Search Existing Purchase**
  - In Purchase Entry, search by bill number or supplier
  - Previous purchases should list
  - Click one to load
  - **Passing Result:** Load successful, data pre-fills

- [ ] **Test: POS Sales Tab**
  - Click "Sales" tab
  - Create new sale:
    - Customer (search or create)
    - Add items from inventory
    - Quantities and prices calculate
  - Submit sale
  - **Passing Result:** Sale recorded, inventory reduces

- [ ] **Test: Inventory Movement Tab**
  - Click "Movement" tab
  - Record stock transfer between categories
  - **Passing Result:** Movement logged

- [ ] **Test: Inventory Report Tab**
  - Click "Report" tab
  - View stock levels, unit prices, total values
  - **Passing Result:** Data displays correctly

---

## ⚙️ SECTION 7: SETTINGS & CONFIGURATION

### 7.1 Shop Settings
**Route:** `/settings` → Shop Settings Tab  
**Key Interactions:** Edit shop name, address, contact, GST, banking details

- [ ] **Test: Load Shop Settings**
  - Navigate to Settings
  - Click "Shop Settings" tab
  - Current shop details should display
  - **Passing Result:** Form pre-populated

- [ ] **Test: Update Shop Details**
  - Edit: Shop name, address, city, state, postal code
  - Edit: Phone, email, GSTIN, PAN
  - Add: UPI ID, website, logo
  - Click "Save"
  - **Passing Result:** Changes saved, toast confirmation

- [ ] **Test: Geolocation Setup**
  - In Shop Settings, if "Get Location" button visible
  - Click to detect garage latitude/longitude
  - **Passing Result:** Coordinates populate

---

### 7.2 Spare Part Shops
**Route:** `/settings` → Spare Part Shops Tab  
**Key Interactions:** CRUD for spare part supplier shops

- [ ] **Test: Load Spare Part Shops**
  - In Settings, click "Spare Part Shops" tab
  - List should display shops
  - **Passing Result:** Data loads

- [ ] **Test: Add New Spare Part Shop**
  - Click "+ Add Shop"
  - Modal opens, fill:
    - Shop Name
    - Mobile
    - Address (lines, city, state, postal code)
    - GSTIN, PAN (optional)
    - State (dropdown for GST)
  - Save
  - **Passing Result:** Shop added to list

- [ ] **Test: Edit Spare Part Shop**
  - Click edit on existing shop
  - Modal opens with data
  - Change one field
  - Save
  - **Passing Result:** Change persists

- [ ] **Test: Delete Spare Part Shop**
  - Click delete on shop
  - Confirm deletion
  - **Passing Result:** Shop removed from list

---

### 7.3 GST States
**Route:** `/settings` → GST States Tab  
**Key Interactions:** Manage GST-enabled states for tax calculations

- [ ] **Test: Load States**
  - Click "GST States" tab
  - List of configured states
  - **Passing Result:** Data displays

- [ ] **Test: Add GST State**
  - Click "+ Add State"
  - Fill: State Name, State Code (2-char)
  - Save
  - **Passing Result:** State added

- [ ] **Test: Edit GST State**
  - Click edit on state
  - Change name or code
  - Save
  - **Passing Result:** Change saved

---

## 👨‍🔧 SECTION 8: TECHNICIAN PORTAL

### 8.1 Technician Job Board
**Route:** `/tech` or `/technician`  
**Key Interactions:** View assigned jobs, accept jobs, start work, mark complete

- [ ] **Test: Technician Login**
  - Login as technician (role: technician)
  - Should land on technician job board
  - **Passing Result:** Dashboard shows assigned jobs

- [ ] **Test: View Assigned Jobs**
  - List should show cards with:
    - Job status (assigned, accepted, in_progress, completed)
    - Job card number
    - Vehicle details (registration, make, model)
    - Customer name (if available)
    - Task type
  - **Passing Result:** All info visible

- [ ] **Test: Accept Job**
  - If job status is "assigned"
  - Click "Accept" button
  - Job status should change to "accepted"
  - **Passing Result:** Status updates, button changes to "Start Work"

- [ ] **Test: Start Work**
  - After accepting, click "Start Work"
  - Job status changes to "in_progress"
  - **Passing Result:** Status updated

- [ ] **Test: Complete Job**
  - While in progress, click "Complete"
  - Modal may appear for completion details
  - Submit
  - **Passing Result:** Job marked completed

- [ ] **Test: Filter by Status**
  - If filtering available, filter by status
  - List should show only jobs of that status
  - **Passing Result:** Filter works

---

## 🎥 SECTION 9: FACE RECOGNITION & ML FEATURES

### 9.1 Mobile Attendance with Face Verification
**Route:** `/mobile-attendance`  
**Component:** Mobile device access with face API integration  
**Key Interactions:** Camera access, face detection, liveness verification, attendance submission

- [ ] **Test: Load Mobile Attendance Page**
  - Access on mobile device or desktop with camera
  - Page should load
  - Check if face verification configured
  - **Passing Result:** Page loads without errors

- [ ] **Test: Camera Permissions**
  - Click "Open Camera" or similar button
  - Browser should request camera permissions
  - Grant permissions
  - Camera feed should display
  - **Passing Result:** Live video from camera visible

- [ ] **Test: Face Detection**
  - Face should appear on camera feed
  - Face detection box/guide should appear
  - System should guide face positioning
  - **Passing Result:** Face detected, "Good!" or quality indicator shows

- [ ] **Test: Face API Ready Check**
  - If face-api.js mode enabled:
    - Models should load (check console for timing)
    - Face landmarks should be drawn on video
  - **Passing Result:** Landmarks visible after positioning face

- [ ] **Test: Attendance Auto-Submit**
  - Hold face in frame for guidance completion
  - After quality threshold met, attendance should auto-submit
  - **Passing Result:** Success message appears, attendance recorded

- [ ] **Test: Geolocation Verification** 
  - During submission, geolocation requested
  - Must be within garage attendance radius
  - **Passing Result:** Location verified or error if outside radius

- [ ] **Test: Face Verification Against Reference**
  - User's reference face photo (uploaded during employee setup) compared
  - Similarity score computed
  - **Passing Result:** Verification passes/fails correctly based on match threshold

---

### 9.2 User Approvals with Face Capture
**Route:** `/approvals`  
**Component:** Admin approval page with face photo capture  
**Key Interactions:** Camera capture, face photo for new users

- [ ] **Test: Load Approvals Page**
  - Navigate to Approvals (admin only)
  - List of pending user approvals should display
  - **Passing Result:** Page loads, users listed

- [ ] **Test: Capture Profile Photo**
  - Click "Capture Photo" for pending user
  - Camera opens
  - Position face, capture
  - **Passing Result:** Photo captured, preview displayed

- [ ] **Test: Toggle Camera**
  - While camera open, click "Switch Camera"
  - If device has multiple cameras (front/back), camera should switch
  - **Passing Result:** Camera feed switches

- [ ] **Test: Device Approval**
  - In Device Requests section, approve or reject pending devices
  - **Passing Result:** Device approval updated

---

## 📅 SECTION 10: DATE HANDLING & DATE PICKER

### 10.1 DatePickerInput Component
**Used in:** Job Cards, Attendance, Employees, Inventory purchases, Spare Parts ledger  
**Component:** DatePickerInput (custom calendar widget)  
**Key Interactions:** Text input, date picker modal, date selection

- [ ] **Test: Date Picker Visual**
  - Click any date input field (calendar icon or text field)
  - Calendar modal should open
  - Current month displayed with days
  - Navigation arrows for prev/next month
  - **Passing Result:** Calendar fully visible, responsive

- [ ] **Test: Month Navigation**
  - In calendar, click left arrow to go to previous month
  - Click right arrow for next month
  - **Passing Result:** Calendar updates, correct month displayed

- [ ] **Test: Date Selection**
  - Click a date in calendar
  - Field should populate with selected date in format dd-mm-yy
  - Calendar should close
  - **Passing Result:** Date correct, format consistent

- [ ] **Test: Manual Date Entry**
  - Click date field, type date manually: "25-03-26"
  - Calendar should show selected date
  - **Passing Result:** Manual entry parsed correctly

- [ ] **Test: Invalid Date Rejection**
  - Type invalid date: "99-99-99" or "abc"
  - Field should not accept or show error
  - **Passing Result:** Invalid date rejected

- [ ] **Test: Today's Date Button**
  - If calendar has "Today" button, click it
  - **Passing Result:** Today's date selected and populated

- [ ] **Test: Date Picker in Dynamic Tables**
  - In spare parts row with date field, click date picker
  - Select date
  - Date persists in table, doesn't clear on blur
  - **Passing Result:** Date stable after selection

---

## 🚨 SECTION 11: ERROR HANDLING & EDGE CASES

### 11.1 Network Error Handling
- [ ] **Test: Offline Submission**
  - Simulate network disconnect (DevTools Network tab, set offline)
  - Try to save form (employee, job card, etc.)
  - **Passing Result:** Error toast appears: "Network error" or similar

- [ ] **Test: Slow Network**
  - DevTools, set slow 3G
  - Load data table (employees, job cards)
  - Loading spinner should appear during fetch
  - **Passing Result:** Spinner visible, data loads after delay

- [ ] **Test: Server Error (500)**
  - If backend endpoint unavailable, try to save
  - **Passing Result:** Error message displayed to user

- [ ] **Test: Timeout**
  - Simulated slow API response (10+ seconds)
  - **Passing Result:** Timeout error shown or retry offered

---

### 11.2 Validation & Constraints
- [ ] **Test: Required Field Missing**
  - Try to save form (any form) without required fields
  - **Passing Result:** Validation error prevents submission

- [ ] **Test: Data Type Mismatch**
  - In salary field, enter letters
  - In quantity field, enter decimal when integer required
  - **Passing Result:** Field rejects non-numeric or shows error

- [ ] **Test: Amount Precision**
  - Enter amount with 3 decimal places (e.g., 100.999)
  - System should round or truncate to 2 decimals
  - **Passing Result:** Displayed as 100.99 or 101.00

---

### 11.3 Concurrent Operations
- [ ] **Test: Rapid Form Submissions**
  - Click "Save" button 5+ times in quick succession
  - **Passing Result:** Only one submission processed, other clicks ignored or queued

- [ ] **Test: Edit While Fetching**
  - Start editing employee record while employee list still loading
  - Changing form fields should not interfere with load
  - **Passing Result:** No race condition, data loads correctly

- [ ] **Test: Tab Switch During Load**
  - Navigate to Attendance tab, it's loading
  - Before load completes, switch to another tab
  - Return to Attendance
  - **Passing Result:** Correct data loads, no stale state

---

### 11.4 Mobile Responsiveness
- [ ] **Test: Viewport < 640px (Mobile)**
  - Resize browser to mobile width
  - All forms should stack vertically
  - Buttons should be touch-sized (min 44x44px)
  - **Passing Result:** Layout responsive, all elements accessible

- [ ] **Test: Tablet (768px)**
  - Resize to tablet width
  - 2-column layout if applicable
  - **Passing Result:** Layout adapts

- [ ] **Test: Desktop (1920px+)**
  - Full width, multi-column as intended
  - **Passing Result:** Not overflowing, readable

---

### 11.5 Long Data Handling
- [ ] **Test: Long Customer Name**
  - Create customer with 100+ character name
  - Should handle gracefully (truncate/wrap)
  - **Passing Result:** No UI breaking

- [ ] **Test: Large Employee List**
  - If system has 500+ employees
  - List should filter/paginate efficiently
  - Search should work
  - **Passing Result:** No UI lag, <1s response time

- [ ] **Test: Large Job Card**
  - Create job card with 100+ spare parts rows
  - Scrolling should be smooth
  - Totals should calculate correctly
  - **Passing Result:** No performance issues

---

## ✅ REGRESSION TESTING FROM RECENT CHANGES

### 8 useCallback Optimizations Applied
**Session 1 (HIGH Benefit):** 4 functions  
**Session 2 (MEDIUM Benefit):** 4 functions

- [ ] **Verify handleDeleteFromList() in Employee Master**
  - Delete 20+ employees in rapid succession
  - No lag between deletes
  - Modal doesn't interfere

- [ ] **Verify openAttendanceRowEditor() in Attendance**
  - Rapid editing of 20+ attendance rows
  - Correct data loads for each row
  - No stale state issues

- [ ] **Verify handleNavigatePrevious/Next() in Job Cards**
  - Rapid navigation between job cards (10+)
  - Correct cards load
  - No lag or wrong data

- [ ] **Verify handleAddNew() in Employee Master**
  - Click "Add New Employee" 15+ times
  - Modal opens fresh each time
  - No duplicate modals or data carry-over

- [ ] **Verify handleModalOpenChange() in Employee Master**
  - Open employee → close → open different employee
  - Modal resets properly between opens
  - No old data showing

- [ ] **Verify handleSave() in Employee Master**
  - Create and edit multiple employees (10+ operations)
  - Each save correctly updates that employee
  - Totals don't cross-contaminate

- [ ] **Verify fetchAttendance() in Attendance Module**
  - Rapid date changes in attendance (5+ dates)
  - Each date fetch gets correct records
  - No circular reference issues
  - useEffect properly triggers data updates

---

## 📱 SMOKE TEST (Quick Validation)

Run this if you only have 5-10 minutes:

1. ✅ **Login** → Enter mobile, get OTP, verify
2. ✅ **Navigate** → Sidebar menu, switch forms, no errors
3. ✅ **Create Job Card** → Search customer, vehicle, save
4. ✅ **Employee CRUD** → Add/Edit/Delete employee
5. ✅ **Attendance** → Load by date, edit row, save
6. ✅ **Inventory** → Add purchase entry
7. ✅ **Settings** → Update shop settings
8. ✅ **Check Console** → No errors in browser DevTools

**Expected Result:** No crashes, forms work, data persists

---

## 🐛 BUG REPORT TEMPLATE

If you find issues while testing, please document:

```markdown
### Bug: [Brief Title]

**Route:** /path/to/page  
**Component:** ComponentName  
**Steps:**
1. Navigate to page
2. Fill in X
3. Click Y
4. Observe Z

**Expected:** [What should happen]  
**Actual:** [What happened instead]  
**Screenshot/Video:** [If possible]  
**Browser:** [Chrome v130 on MacOS 14.2, etc.]  
**Severity:** [Critical | High | Medium | Low]

**Notes:** Any additional context
```

---

## 📊 TEST RESULTS LOG

| Date | Tester | Build | Tests Run | Passed | Failed | Notes |
|------|--------|-------|-----------|--------|--------|-------|
|      |        |       |           |        |        |       |
|      |        |       |           |        |        |       |

---

## 🎯 FOCUS AREAS FOR THIS CYCLE

Given recent useCallback optimizations:

1. **Performance**: No lag in sequential operations (delete, edit, navigate)
2. **State Isolation**: Each form/record operation doesn't affect others
3. **Modal Behavior**: Open/close resets state properly
4. **Data Freshness**: Fetches always get latest, no stale closures
5. **Date Handling**: Calendar, date selection, persistence all work
6. **Face Recognition**: Camera, verification, geolocation all functional

---

**Last Verified:** March 25, 2026  
**Build Version:** v16.1.6 Next.js  
**Compile Time:** 24.6s (Production Ready)


# New JobCard Form - Feature Documentation

## Overview
The New JobCard form is a comprehensive web form with automated lookup features, cascading dropdowns, and modal popups for creating job cards in the garage management system. It provides a smooth user experience with validation, auto-population of fields, and unsaved changes detection.

## Features

### 1. Mobile Number (Searchable Dropdown)
- **Auto-filtering**: As users type the mobile number, the system searches and displays matching customers from the database
- **Auto-complete**: Select a customer from the dropdown to automatically populate the customer name
- **Customer Creation**: If a customer is not found, a popup appears asking to create a new customer record
- **Minimum Input**: Search triggers after 3 characters

### 2. Customer Name
- **Auto-populated**: Read-only field that automatically fills when a valid mobile number is selected
- **Data Binding**: Linked to the selected customer record

### 3. Registration Number (Cascading Dropdown)
- **Cascading Logic**: Displays only vehicles linked to the selected customer
- **Dynamic Options**: 
  - Vehicle list filtered by selected customer
  - Final row: "+ Add New Vehicle" to add new vehicles directly
- **Vehicle Selection**: Clicking a vehicle auto-populates the vehicle model and refreshes the JobCard number

### 4. JobCard Number (Auto-generated)
- **Format**: `JC-[ShopCode]-[Year]-[Sequence]`
- **Example**: `JC-AL-2026-0001`
- **Configuration**: ShopCode is globally configurable (default: "AL")
- **Sequential**: Automatically increments based on the last jobcard created
- **Read-only**: Auto-populated and cannot be edited

### 5. Vehicle Model
- **Auto-populated**: Read-only field that automatically fills when a vehicle is selected
- **Format**: Displays as "[Make] [Model]"

### 6. Date Field
- **Default**: Pre-filled with the current system date
- **Editable**: Users can change the date if needed

### 7. JobCard Status
- **Default**: "Under Service"
- **Options**: 
  - Under Service
  - Completed
  - Delivered
  - Pending
  - On Hold
- **Dropdown**: Easy selection from predefined status options

### 8. Additional Fields
- **File No**: Optional file number for reference
- **KM Driven**: Optional kilometer reading
- **Buttons**: Save and Cancel buttons for form submission

## Form Layout

The form is organized in a responsive 3-column grid with the following layout:

**Row 1:**
- Mobile Number (Searchable Dropdown)
- Registration Number (Cascading Dropdown)
- KM Driven (Text Input)

**Row 2:**
- Customer Name (Auto-populated, Read-only)
- Date (Date Input)
- File No (Text Input)

**Row 3:**
- Vehicle Model (Auto-populated, Read-only)
- JobCard Number (Auto-generated, Read-only)
- JobCard Status (Dropdown)

**Action Row:**
- Save JobCard Button
- Cancel Button

## Validation & Safety

### Required Fields Validation
On clicking "Save", the system validates:
- Mobile Number and Customer must be selected
- Vehicle Registration Number and Vehicle must be selected

If validation fails, a popup appears: "Required fields are empty. Please fill them before saving."

### Unsaved Changes Detection
- **Change Detection**: The form monitors all field changes
- **Warning on Exit**: If users try to navigate away with unsaved changes, a browser warning appears
- **Data Safety**: Data is NOT persisted to the database until the "Save" button is clicked

## Modals

### Add New Customer Modal
Triggered when:
- User enters a mobile number that doesn't exist in the database
- Accessible from the customer dropdown

Features:
- Mobile Number (pre-filled, read-only): The number entered by the user
- Customer Name (required): Full name of the customer
- Email (optional): Customer email address
- Address (optional): Customer address
- City, State, Pincode (optional): Additional address details

### Add New Vehicle Modal
Triggered when:
- User clicks "+ Add New Vehicle" in the registration dropdown
- Accessible after selecting a customer

Features:
- Registration Number (required): Vehicle registration plate number
- Make (required): Vehicle manufacturer (e.g., Maruti)
- Model (required): Vehicle model name (e.g., Swift)
- Year (optional): Manufacturing year
- Color (optional): Vehicle color

## API Endpoints

### Customer APIs
- **GET /api/customers**: Search customers by mobile number
  - Query params: `search` (mobile number to search)
  - Returns: Array of matching customers
  
- **POST /api/customers**: Create a new customer
  - Body: `{ mobileNo, name, email, address, city, state, pincode }`
  - Returns: Created customer object

### Vehicle APIs
- **GET /api/vehicles**: Fetch vehicles for a customer
  - Query params: `customerId` (required)
  - Returns: Array of vehicles
  
- **POST /api/vehicles**: Create a new vehicle
  - Body: `{ registrationNumber, make, model, year, color, customerId }`
  - Returns: Created vehicle object

### JobCard APIs
- **GET /api/jobcards/next-number**: Generate next JobCard number
  - Query params: `shopCode`, `year`
  - Returns: `{ jobCardNumber, sequence }`
  
- **POST /api/jobcards**: Create a new JobCard
  - Body: `{ jobCardNumber, shopCode, customerId, vehicleId, serviceDate, fileNo, kmDriven, jobcardStatus }`
  - Returns: Created JobCard with customer and vehicle details

## Configuration

### Global Shop Code
The shop code is globally configurable and used in:
- JobCard number generation
- Database seeding
- Multi-location support

**Location**: `lib/constants.ts`

```typescript
export const SHOP_CODE = process.env.NEXT_PUBLIC_SHOP_CODE || "AL"
```

**Environment Variable**: `NEXT_PUBLIC_SHOP_CODE`

**Default**: "AL" (Bangalore)

## Database Schema

### Customer Model
```prisma
model Customer {
  id              String @id @default(cuid())
  mobileNo        String @unique
  name            String
  email           String?
  address         String?
  city            String?
  state           String?
  pincode         String?
  vehicles        Vehicle[]
  jobCards        JobCard[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Vehicle Model
```prisma
model Vehicle {
  id                  String @id @default(cuid())
  registrationNumber  String @unique
  make                String
  model               String
  year                Int?
  color               String?
  customerId          String
  customer            Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  jobCards            JobCard[]
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### JobCard Model (Updated)
```prisma
model JobCard {
  id                      String @id @default(cuid())
  jobCardNumber           String @unique
  shopCode                String @default("AL")
  serviceDate             DateTime
  fileNo                  String?
  deliveryDate            DateTime?
  kmDriven                Int?
  jobcardStatus           String @default("Under Service")
  // ... other fields
  customerId              String
  vehicleId               String
  customer                Customer @relation(fields: [customerId], references: [id])
  vehicle                 Vehicle @relation(fields: [vehicleId], references: [id])
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}
```

## File Structure

```
components/
├── dashboard/
│   ├── new-job-card-form.tsx    # Main form component
│   ├── add-customer-modal.tsx    # Customer creation modal
│   └── add-vehicle-modal.tsx     # Vehicle creation modal
│
app/
├── api/
│   ├── customers/
│   │   └── route.ts             # Customer API endpoints
│   ├── vehicles/
│   │   └── route.ts             # Vehicle API endpoints
│   └── jobcards/
│       ├── route.ts             # JobCard creation endpoint
│       └── next-number/
│           └── route.ts         # JobCard number generation
│
lib/
├── constants.ts                 # Global configuration (ShopCode)
├── prisma.ts                    # Prisma client singleton
└── utils.ts                     # Utility functions
```

## Usage

1. **Navigate** to "New Job Card" from the sidebar
2. **Enter Mobile Number** and search for or create a customer
3. **Select Vehicle** from the cascading dropdown (or add a new one)
4. **Fill Additional Fields** (date, file number, KM driven)
5. **Review Auto-populated Fields** (customer name, vehicle model, jobcard number)
6. **Save** the JobCard or **Cancel** to discard

## Error Handling

The form includes comprehensive error handling:
- **Network Errors**: Displays toasts with error messages
- **Validation Errors**: Clear error messages for required fields
- **Duplicate Entries**: Prevents duplicate customers/vehicles with appropriate messages
- **Unsaved Changes**: Browser warning when navigating away

## User Experience Enhancements

- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Feedback**: Toast notifications for success/error messages
- **Debouncing**: Customer search debounced to reduce API calls
- **Disabled States**: Fields appropriately disabled during loading states
- **Loading Indicators**: Visual feedback during async operations
- **Keyboard Friendly**: All modals and dropdowns are keyboard accessible

## Future Enhancements

Potential improvements for future versions:
- Batch customer/vehicle imports
- Customer history and previous jobcards
- Vehicle maintenance schedule tracking
- Add service type categorization
- Generate PDF jobcard receipts
- Print-friendly format

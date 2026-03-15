# New JobCard Form - Quick Start Guide

## What Was Built

A complete dynamic JobCard creation form with:
- ✅ Searchable mobile number dropdown with customer lookup
- ✅ Auto-populated customer name field
- ✅ Cascading vehicle dropdown filtered by customer
- ✅ "+ Add New Vehicle" option in dropdown
- ✅ Auto-generated JobCard numbers (JC-AL-2026-XXXX format)
- ✅ Auto-populate vehicle model
- ✅ Date field with current date default
- ✅ JobCard status dropdown (default: "Under Service")
- ✅ Modal popups for adding new customers and vehicles
- ✅ Required field validation
- ✅ Unsaved changes detection with browser warning
- ✅ Clean, modern UI with responsive design

## Files Created/Modified

### New Files Created:
1. **Components**:
   - `components/dashboard/new-job-card-form.tsx` - Main form component (450+ lines)
   - `components/dashboard/add-customer-modal.tsx` - Customer creation modal
   - `components/dashboard/add-vehicle-modal.tsx` - Vehicle creation modal

2. **API Endpoints**:
   - `app/api/customers/route.ts` - Search and create customers
   - `app/api/vehicles/route.ts` - Fetch and create vehicles
   - `app/api/jobcards/route.ts` - Create jobcards
   - `app/api/jobcards/next-number/route.ts` - Generate jobcard numbers

3. **Configuration & Database**:
   - `lib/constants.ts` - Global configuration (ShopCode, statuses, etc.)
   - `lib/prisma.ts` - Prisma client singleton
   - `prisma/migrations/20260216081324_add_customer_vehicle_models/migration.sql` - Database schema update

4. **Documentation**:
   - `NEW_JOBCARD_FORM_DOCUMENTATION.md` - Complete feature documentation
   - `.env.example` - Environment variable template
   - This guide

### Modified Files:
1. **Database Schema**:
   - `prisma/schema.prisma` - Added Customer and Vehicle models, updated JobCard model

2. **Main Page**:
   - `app/page.tsx` - Integrated NewJobCardForm component

## Installation & Setup

### 1. Environment Configuration
```bash
# Copy the example env file
cp .env.example .env.local

# Update NEXT_PUBLIC_SHOP_CODE if needed (default is "AL")
```

### 2. Database Migration
The migration has already been applied. If you need to reset:
```bash
# Reset and re-apply migrations
npx prisma migrate reset

# Or push schema to database
npx prisma db push
```

### 3. Generate Prisma Client
```bash
# This is already done, but if needed:
npx prisma generate
```

### 4. Run Development Server
```bash
npm run dev
# Navigate to http://localhost:3000
# Click "New Job Card" in the sidebar
```

## How the Form Works

### Step 1: Search & Select Customer
1. Enter a mobile number in the "Mobile Number" field
2. The system searches for customers after 3 characters
3. Select a matching customer from the dropdown
4. If not found, a popup offers to create a new customer

### Step 2: Select or Add Vehicle
1. Click the "Registration Number" field
2. View vehicles linked to the selected customer
3. Select a vehicle or click "+ Add New Vehicle"
4. Vehicle model auto-populates

### Step 3: Auto-Generated Fields
- JobCard Number: `JC-AL-2026-0001` (auto-generated)
- Date: Defaults to today (editable)
- Status: Defaults to "Under Service"

### Step 4: Optional Fields
- File Number: Optional reference number
- KM Driven: Optional kilometer reading

### Step 5: Save
1. Click "Save JobCard" button
2. Form validates required fields
3. JobCard is saved to database
4. Form resets for next entry

## API Response Examples

### Create Customer
```bash
POST /api/customers
{
  "mobileNo": "9999999999",
  "name": "John Doe",
  "email": "john@example.com",
  "address": "123 Main St",
  "city": "Bangalore",
  "state": "Karnataka",
  "pincode": "560001"
}
```

### Create Vehicle
```bash
POST /api/vehicles
{
  "registrationNumber": "KA-01-AB-1234",
  "make": "Maruti",
  "model": "Swift",
  "year": 2023,
  "color": "Red",
  "customerId": "clixxxx..."
}
```

### Create JobCard
```bash
POST /api/jobcards
{
  "jobCardNumber": "JC-AL-2026-0001",
  "shopCode": "AL",
  "customerId": "clixxxx...",
  "vehicleId": "clixxxx...",
  "serviceDate": "2026-02-16",
  "fileNo": "FILE-001",
  "kmDriven": 50000,
  "jobcardStatus": "Under Service"
}
```

## Configuration Options

### Shop Code
Edit `lib/constants.ts` or set the environment variable:
```env
NEXT_PUBLIC_SHOP_CODE="AL"  # Change to your shop code
```

This value is used in:
- JobCard number format
- Database records
- Multi-location support

### JobCard Status Options
Edit `lib/constants.ts` to customize:
```typescript
export const JOB_CARD_STATUSES = [
  "Under Service",
  "Completed",
  "Delivered",
  "Pending",
  "On Hold",
]
```

## Testing the Form

### Test User Flow:
1. **Create New Customer**:
   - Enter non-existent mobile number
   - Click "Create Customer" when prompted
   - Fill in customer details

2. **Add New Vehicle**:
   - Select customer
   - Click "+ Add New Vehicle"
   - Enter vehicle details

3. **Create JobCard**:
   - All fields auto-populate
   - Modify optional fields as needed
   - Click "Save JobCard"

4. **Test Unsaved Changes**:
   - Make changes to form
   - Try to navigate/close
   - Browser shows "Are you sure?" warning

5. **Test Validation**:
   - Click Save without selecting customer
   - See validation error popup

## Troubleshooting

### Issue: "Customer not found" dialog appears when selecting customer
**Solution**: Make sure the customer was created successfully. Check by examining the dropdown list.

### Issue: Vehicle dropdown not showing vehicles
**Cause**: Customer not properly selected
**Solution**: Ensure you select a customer from the auto-complete dropdown

### Issue: Form fields not auto-populating
**Cause**: Network delay or API error
**Solution**: Check browser console for errors, verify API endpoints are running

### Issue: Unsaved changes warning not appearing
**Cause**: No actual changes made (form matches initial state)
**Solution**: This is expected behavior - only warns when changes are detected

## Database Quick Reference

### Customer Fields
- `id`: Unique identifier
- `mobileNo`: Unique mobile number (indexed)
- `name`: Customer name (indexed)
- `email`: Optional email
- `address`: Optional address
- `city`, `state`, `pincode`: Optional location

### Vehicle Fields
- `id`: Unique identifier
- `registrationNumber`: Unique vehicle registration (indexed)
- `make`: Vehicle manufacturer
- `model`: Vehicle model
- `year`: Manufacturing year (optional)
- `color`: Vehicle color (optional)
- `customerId`: Foreign key to Customer

### JobCard Fields (Updated)
- `jobCardNumber`: Unique job card number (indexed)
- `shopCode`: Shop location code (default: "AL")
- `customerId`: Foreign key to Customer (indexed)
- `vehicleId`: Foreign key to Vehicle (indexed)
- `serviceDate`: Date of service
- `jobcardStatus`: Status (default: "Under Service")
- Other service-related fields...

## Performance Notes

- **Debounced Search**: Customer search is debounced (300ms) to reduce API calls
- **Indexed Fields**: Mobile number, customer name, registration number, and vehicle details are indexed for fast searches
- **Cascading Dropdowns**: Vehicles are fetched only when a customer is selected
- **Sequential Numbering**: JobCard number generation uses efficient database queries

## Future Enhancements

Planned improvements:
- [ ] Edit existing jobcards
- [ ] Delete jobcards with confirmation
- [ ] Jobcard history and search
- [ ] Service type checkboxes (Electrical, AC, Mechanical, Others)
- [ ] Attached services/spare parts
- [ ] Estimate and billing integration
- [ ] SMS/Email notifications
- [ ] PDF receipt generation
- [ ] Barcode scanning for quick vehicle lookup

## Support & Questions

For detailed API documentation and features, see:
📖 `NEW_JOBCARD_FORM_DOCUMENTATION.md`

For issues or questions, check:
- Browser console for errors
- Network tab in DevTools for API responses
- Prisma Studio: `npx prisma studio`

# Garage Management App - Inventory & POS System

## Overview

This is a comprehensive Garage Management application built with Next.js, Prisma, and Tailwind CSS. It includes:

1. **JobCard Management** - Track vehicle service requests with automated numbering and customer lookups
2. **Inventory & POS System** - Manage purchases, sales, and real-time stock tracking
3. **Stock & Billing** - Complete billing and inventory reporting

## System Architecture

### Database Schema

The application uses SQLite (configurable for PostgreSQL/MySQL in production) with the following main tables:

#### Core Tables
- **Customer** - Customer information with GSTIN/PAN
- **Vehicle** - Vehicle details linked to customers
- **JobCard** - Service requests with automated numbering

#### Inventory Tables
- **Supplier** - Vendor information
- **Product** - Product catalog with pricing and tax rates
- **Category** - Product categorization
- **Purchase** - Purchase orders from suppliers
- **PurchaseDetails** - Line items for purchases
- **Sale** - Sales/billing records
- **SaleDetails** - Line items for sales with returns tracking

#### Support Tables
- **State** - Regional/state information
- **Employee** - Technician/staff details
- **EmployeeEarning** - Labor cost tracking
- **ServiceDescription** - Service line items for jobs
- **SparePartsBill** - External supplier bills

## Features

### 1. Purchase Entry Module (`/inventory-pos` - Purchase Tab)

**Purpose**: Record inward stock movements from suppliers

**Key Features**:
- ✅ Searchable supplier selection with autocomplete
- ✅ Add new suppliers on-the-fly via modal
- ✅ Auto-populate supplier details (address, phone, GSTIN)
- ✅ Product search and selection
- ✅ Real-time calculation of:
  - Amount = Quantity × Purchase Price
  - SGST Amount = Amount × SGST Rate / 100
  - CGST Amount = Amount × CGST Rate / 100
  - Total Amount = Amount + SGST + CGST
- ✅ Auto-increment product balance stock
- ✅ Unsaved changes detection
- ✅ Transaction-based save (all or nothing)

**UI Layout**:
```
[Row 1] Supplier Selection | Purchase Date | Supplier Info
[Row 2] Product Search
[Row 3] Line Items Table (Dynamic Rows)
[Row 4] Summary Card with Totals
[Row 5] Action Buttons (Clear, Save)
```

### 2. POS Sales Module (`/inventory-pos` - Sales Tab)

**Purpose**: Record outward stock movements (sales/billing)

**Key Features**:
- ✅ Customer search by mobile or vehicle registration
- ✅ Product search with stock availability check
- ✅ Real-time calculations:
  - Amount = Quantity × Sale Price
  - Discount Amount = Amount × Discount % / 100
  - Access Amount = Amount - Discount Amount
  - SGST Amount = Access Amount × SGST % / 100
  - CGST Amount = Access Amount × CGST % / 100
  - Total Amount = Access Amount + SGST + CGST
- ✅ Stock warning alerts (insufficient stock)
- ✅ Return tracking with return dates
- ✅ Bill generation and numbering
- ✅ Auto-decrement product balance stock
- ✅ Unsaved changes detection

**UI Layout**:
```
[Row 1] Customer Search | Bill Date | Quick Actions
[Row 2] Stock Warnings (if any)
[Row 3] Product Search
[Row 4] Line Items Table with Return Columns
[Row 5] Summary Card (Blue themed for sales)
[Row 6] Action Buttons
```

### 3. Inventory Report Module (`/inventory-pos` - Inventory Tab)

**Purpose**: Dashboard view of stock levels and movements

**Key Features**:
- ✅ Real-time stock calculations:
  - Current Balance = Total Purchased - Total Sold + Total Returned
  - Balance Value = Current Balance × Purchase Price
- ✅ Filter by:
  - Product name (search)
  - Category
  - Supplier
- ✅ Summary cards showing:
  - Total Inventory Value
  - Products In Stock
  - Low Stock Items (<10 units)
  - Out of Stock Items
- ✅ Low stock warnings
- ✅ Color-coded rows (red for out of stock, yellow for low stock)
- ✅ CSV export capability
- ✅ Real-time data refresh

**UI Layout**:
```
[Row 1] Title & Description
[Row 2] Filter Controls (Search, Category, Supplier, Refresh, Export)
[Row 3] Summary Cards (4 cards with key metrics)
[Row 4] Low Stock Alert (if any)
[Row 5] Data Table with all inventory
[Row 6] Footer with record count and last updated time
```

## Configuration

### Shop Settings

Configure your shop details in `/lib/config.ts`:

```typescript
CONFIG.SHOP = {
  CODE: 'AL',           // Used in JobCard numbering: JC-AL-2025-0001
  NAME: 'Your Shop Name',
  ADDRESS: 'Your Address',
  PHONE: '+91 XXXXXXXXXX',
  GSTIN: 'GST Number',
}
```

### Tax Rates

Default tax rates in `/lib/config.ts`:

```typescript
CONFIG.INVENTORY.TAX = {
  DEFAULT_SGST_RATE: 9,
  DEFAULT_CGST_RATE: 9,
  DEFAULT_IGST_RATE: 18,
}
```

### Stock Warning Threshold

Low stock warning triggers when inventory falls below:
```typescript
CONFIG.INVENTORY.STOCK_WARNING_THRESHOLD = 10 // units
```

## API Endpoints

### Purchase APIs

```
GET  /api/purchases                    # List purchases with pagination
POST /api/purchases                    # Create new purchase
```

### Sales APIs

```
GET  /api/sales                        # List sales/bills
POST /api/sales                        # Create new sale bill
```

### Supplier APIs

```
GET  /api/suppliers?search=keyword    # Search suppliers
POST /api/suppliers                    # Create new supplier
```

### Product APIs

```
GET  /api/products?supplierId=id      # Get products by supplier
POST /api/products                     # Create new product
```

### Inventory Report API

```
GET  /api/inventory/report            # Get stock report with calculations
```

## Data Integrity Features

### 1. Transaction-Based Operations

All purchase and sale operations use database transactions to ensure:
- Either all data is saved or none is saved
- Stock updates happen atomically with bill creation
- No partial updates that could corrupt inventory

### 2. Stock Validation

- Purchase: Validates supplier exists before adding products
- Sale: Checks stock availability before allowing bill creation
- Auto-updates product balance on successful save

### 3. Unsaved Changes Detection

- Detects if user closes/navigates page with unsaved changes
- Shows warning dialog to prevent data loss
- Only persists data when "Save" button is clicked

### 4. Validation Rules

**Purchase Entry**:
- Supplier must be selected
- At least one product must be added
- All required fields in header form must be filled

**POS Sales**:
- At least one product must be added
- Quantity cannot exceed available stock
- Warning system alerts user of stock issues
- All calculations verified before save

## Calculation Methods

### Purchase Line Calculations

```
Amount = Quantity × Purchase Price
SGST Amount = Amount × (SGST Rate / 100)
CGST Amount = Amount × (CGST Rate / 100)
Total Amount = Amount + SGST Amount + CGST Amount
Balance Stock = Quantity (new stock added)
```

### Sale Line Calculations

```
Amount = Quantity × Sale Price
Discount Amount = Amount × (Discount % / 100)
Access Amount = Amount - Discount Amount
SGST Amount = Access Amount × (SGST Rate / 100)
CGST Amount = Access Amount × (CGST Rate / 100)
Total Amount = Access Amount + SGST Amount + CGST Amount
Stock Out = Quantity - Return Quantity
```

### Inventory Balance Calculation

```
Total Purchased = Sum of all quantities in PurchaseDetails
Total Sold = Sum of all quantities in SaleDetails
Total Returned = Sum of all return quantities in SaleDetails
Current Balance = Total Purchased - Total Sold + Total Returned
Balance Value = Current Balance × Purchase Price
```

## UI Design System

### Color Scheme

- **Blue** (#3b82f6) - Primary actions, selected states
- **Green** (#10b981) - Success, positive metrics
- **Yellow/Amber** (#f59e0b) - Warnings, low stock alerts
- **Red** (#ef4444) - Errors, out of stock
- **Slate** (#64748b) - Secondary text, disabled states

### Component Layout

All forms follow a consistent 3-column grid layout:
- **Column 1**: Selection/Search fields
- **Column 2**: Date/Reference fields
- **Column 3**: Summary/Display-only fields

Tables use horizontal scrolling on mobile and are full-width on desktop.

## Getting Started

### Installation

```bash
# Install dependencies
npm install --legacy-peer-deps

# Set up environment
cp .env.example .env.local

# Update database URL (already configured for SQLite)
# DATABASE_URL="file:./prisma/dev.db"

# Run migrations
npx prisma migrate dev --name init

# Start development server
npm run dev
```

### Accessing the System

- **JobCard Module**: `/app/jobcard/page.tsx` (create as needed)
- **Inventory & POS**: Navigate to `/inventory-pos`
  - Purchase Entry: Select "📦 Purchase Entry" tab
  - POS Sales: Select "🛒 POS Sales" tab
  - Inventory Report: Select "📊 Inventory Report" tab

## Database Management

### Reset Database (Development)

```bash
# Reset to clean state (WARNING: Deletes all data)
npx prisma migrate reset --force
```

### View Data

```bash
# Open Prisma Studio to view/edit data
npx prisma studio
```

### Add Sample Data

Create seed file at `prisma/seed.ts` and run:
```bash
npx prisma db seed
```

## Performance Optimization

### Caching

- Supplier lookups cached during session
- Product list cached by supplier selection
- Category and state data cached at load

### Pagination

- Purchase list paginated (10 items per page)
- Sale list paginated (10 items per page)
- Inventory report fetches all (optimize for your data size)

### Indexes

Database has indexes on:
- Supplier ID and Mobile Number
- Product ID, Supplier ID, Category ID
- Sale ID, Product ID, Bill Date
- Purchase ID, Product ID, Purchase Date

## Security Considerations

1. **Input Validation**: All inputs validated at API level
2. **SQL Injection**: Protected by Prisma ORM
3. **CSRF Protection**: Use Next.js built-in protection
4. **Error Messages**: Generic error messages in production
5. **Authentication**: Add middleware (not included in base setup)

## Future Enhancements

1. **User Authentication** - Login/Authorization
2. **Role-Based Access** - Admin, Manager, Technician roles
3. **Report Generation** - PDF bills, inventory summaries
4. **Email Notifications** - Bill emails, low stock alerts
5. **Multi-Shop Support** - Manage multiple branches
6. **Dashboard Analytics** - Sales trends, inventory turnover
7. **Mobile App** - React Native version
8. **Payment Integration** - Online payments, GST calculation

## Troubleshooting

### Common Issues

**1. "Cannot find module '@radix-ui/react-checkbox'"**
```bash
npm install --legacy-peer-deps
```

**2. Database migration errors**
```bash
npx prisma migrate reset --force
npx prisma migrate dev --name init
```

**3. Port already in use (3000)**
```bash
npm run dev -- -p 3001
```

**4. Tailwind styles not showing**
- Clear `.next` folder: `rm -rf .next`
- Rebuild: `npm run dev`

## Support

For issues or questions:
1. Check the configuration in `/lib/config.ts`
2. Review API error messages in browser console
3. Check Prisma Studio for data integrity: `npx prisma studio`
4. Verify database file exists at `prisma/dev.db`

---

**Last Updated**: February 16, 2026
**Version**: 1.0.0
**Built with**: Next.js 16, Prisma 6, Tailwind CSS 4, React 19

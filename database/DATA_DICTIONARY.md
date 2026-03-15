# Database Schema Reference - Data Dictionary

## Table of Contents
1. [Customer Table](#customer-table)
2. [Vehicle Table](#vehicle-table)
3. [Relationships](#relationships)
4. [Indexes](#indexes)
5. [Constraints](#constraints)
6. [Field Specifications](#field-specifications)

---

## Customer Table

### Purpose
Stores master customer information for the garage management system. Serves as the central hub linking customers to their vehicles and service history.

### Table Name: `Customer`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| **CustomerID** | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique identifier for each customer. Auto-generated. |
| **CustomerName** | VARCHAR(255) | NOT NULL, CHECK (LENGTH > 0) | Full name of the customer. Required field. |
| **Address** | TEXT | Optional | Complete address including street, area, city, zip code. Can be NULL. |
| **MobileNo** | BIGINT | NOT NULL, UNIQUE | Mobile phone number. Must be unique (one per customer). Used for customer search/lookup. |
| **StateID** | INTEGER | Optional | Reference to state/province code. Used for regional filtering. Can be NULL. |
| **GSTIN** | VARCHAR(20) | Optional | GST Identification Number (India-specific). Can be NULL. |
| **PAN** | VARCHAR(20) | Optional | PAN (Personal Account Number, India-specific). Can be NULL. |
| **DateCreated** | DATETIME | DEFAULT CURRENT_TIMESTAMP | Automatic timestamp when record is created. Used for chronological sorting. |

### Primary Key
- **CustomerID**: Uniquely identifies each customer record

### Indexes Created
1. **idx_Customer_MobileNo** - On MobileNo field
   - Purpose: Real-time search functionality
   - Performance: O(log n) lookup time
   - Usage: WHERE MobileNo LIKE ?

2. **idx_Customer_Name** - On CustomerName field
   - Purpose: Search by name functionality
   - Usage: WHERE CustomerName LIKE '%john%'

3. **idx_Customer_DateCreated** - On DateCreated field
   - Purpose: Chronological sorting
   - Usage: ORDER BY DateCreated DESC

### Sample Data
```
CustomerID | CustomerName  | MobileNo   | Address                    | StateID | GSTIN      | PAN
-----------|---------------|-----------|----------------------------|---------|-----------|----------
1          | John Doe      | 9999999999| 123 Main St, Bangalore   | 1       | GSTIN123  | PAN123
2          | Ramesh Kumar  | 9999988888| 456 Park Ave, Bangalore  | 1       | GSTIN456  | PAN456
```

---

## Vehicle Table

### Purpose
Stores vehicle information linked to customers. Enables multi-vehicle support (customers can have multiple vehicles registered).

### Table Name: `Vehicle`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| **VehicleID** | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique identifier for each vehicle. Auto-generated. |
| **CustomerID** | INTEGER | NOT NULL, FOREIGN KEY | Reference to Customer.CustomerID. Links vehicle to owner. Cannot be NULL. |
| **RegistrationNumber** | VARCHAR(50) | NOT NULL, UNIQUE | Vehicle registration plate number. Must be unique. Used to identify vehicles. |
| **VehicleMake** | VARCHAR(100) | NOT NULL, CHECK (LENGTH > 0) | Vehicle manufacturer (e.g., Maruti, Hyundai). Required field. |
| **VehicleModel** | VARCHAR(100) | NOT NULL, CHECK (LENGTH > 0) | Vehicle model name (e.g., Swift, i10). Required field. |
| **DateCreated** | DATETIME | DEFAULT CURRENT_TIMESTAMP | Automatic timestamp when record is created. |

### Foreign Key
- **Vehicle.CustomerID** → **Customer.CustomerID**
  - Relationship: Many-to-One
  - Cascade: ON DELETE CASCADE (delete vehicle if customer deleted)
  - Cascade: ON UPDATE CASCADE (update vehicle if customer ID changes)

### Indexes Created
1. **idx_Vehicle_CustomerID** - On CustomerID field
   - Purpose: Cascading dropdown queries
   - Performance: O(log n) lookup
   - Usage: WHERE CustomerID = ?

2. **idx_Vehicle_DateCreated** - On DateCreated field
   - Purpose: Chronological sorting
   - Usage: ORDER BY DateCreated DESC

### Sample Data
```
VehicleID | CustomerID | RegistrationNumber | VehicleMake | VehicleModel
----------|------------|-------------------|-------------|---------------
1         | 1          | KA-01-AB-1234    | Maruti      | Swift
2         | 1          | KA-01-AB-5678    | Hyundai     | i10
3         | 2          | KA-02-CD-1234    | Tata        | Nexon
```

---

## Relationships

### Customer ↔ Vehicle (One-to-Many)

```
Customer (1) ────────── (Many) Vehicle
   |
   └─ One customer can own multiple vehicles
   └─ Each vehicle must belong to exactly one customer
   └─ Foreign key: Vehicle.CustomerID → Customer.CustomerID
```

### Visual Representation

```
┌─────────────────────────────────────────┐
│ Customer Table                          │
├─────────────────────────────────────────┤
│ CustomerID (PK)                         │  ┌──────────────────────────┐
│ CustomerName                            │  │ Vehicle Table            │
│ Address                                 │  ├──────────────────────────┤
│ MobileNo (UNIQUE, INDEXED) ◄────┐       │  │ VehicleID (PK)           │
│ StateID                            │       │  │ CustomerID (FK) ──────────┤─► References Customer
│ GSTIN                              │       │  │ RegistrationNumber       │
│ PAN                                │       │  │ VehicleMake              │
│ DateCreated                        │       │  │ VehicleModel             │
└─────────────────────────────────────────┘  │  │ DateCreated              │
                                             │  └──────────────────────────┘
      One Customer can have Many Vehicles
```

### Cascading delete example:
```sql
-- If we delete a customer:
DELETE FROM Customer WHERE CustomerID = 5

-- All their vehicles are automatically deleted:
-- DELETE FROM Vehicle WHERE CustomerID = 5
-- (Due to ON DELETE CASCADE constraint)
```

---

## Indexes

### Purpose of Indexes
- **Performance**: Fast data retrieval (O(log n) vs O(n))
- **Search**: Enable quick customer/vehicle lookup
- **Real-time Filtering**: Support auto-complete features
- **Cascading**: Fast vehicle retrieval for selected customer

### All Indexes

| Index Name | Table | Field(s) | Type | Purpose |
|------------|-------|----------|------|---------|
| **PRIMARY KEY** | Customer | CustomerID | UNIQUE | Primary identifier |
| **PRIMARY KEY** | Vehicle | VehicleID | UNIQUE | Primary identifier |
| idx_Customer_MobileNo | Customer | MobileNo | UNIQUE | Fast mobile search |
| idx_Customer_Name | Customer | CustomerName | Regular | Name-based search |
| idx_Customer_DateCreated | Customer | DateCreated | Regular | Time-based sorting |
| idx_Vehicle_CustomerID | Vehicle | CustomerID | Regular | Cascading dropdown |
| idx_Vehicle_DateCreated | Vehicle | DateCreated | Regular | Time-based sorting |

### Index Creation Statements
```sql
CREATE UNIQUE INDEX idx_Customer_MobileNo ON Customer(MobileNo);
CREATE INDEX idx_Customer_Name ON Customer(CustomerName);
CREATE INDEX idx_Customer_DateCreated ON Customer(DateCreated);
CREATE INDEX idx_Vehicle_CustomerID ON Vehicle(CustomerID);
CREATE INDEX idx_Vehicle_DateCreated ON Vehicle(DateCreated);
```

### How Indexes Work in Queries

**Without Index** (Full Table Scan):
```sql
SELECT * FROM Customer WHERE MobileNo = 9999999999;
-- Scans all 1000 rows: O(n) ~ 1000 operations
```

**With Index** (Index Lookup):
```sql
SELECT * FROM Customer WHERE MobileNo = 9999999999;
-- Uses idx_Customer_MobileNo: O(log n) ~ 10 operations
-- 100x faster!
```

---

## Constraints

### Unique Constraints
1. **Customer.MobileNo** - UNIQUE
   - Ensures: No duplicate mobile numbers
   - Benefit: Phone number is unique identifier
   - Error on duplicate: `UNIQUE constraint failed`

2. **Vehicle.RegistrationNumber** - UNIQUE
   - Ensures: No duplicate registration plates
   - Benefit: Registration number identifies vehicle
   - Error on duplicate: `UNIQUE constraint failed`

### Not Null Constraints
| Field | Table | Reason |
|-------|-------|--------|
| CustomerName | Customer | Name is essential information |
| MobileNo | Customer | Mobile is required for contact |
| CustomerID | Vehicle | Must link to a customer |
| RegistrationNumber | Vehicle | Registration plate is essential |
| VehicleMake | Vehicle | Manufacturer is required |
| VehicleModel | Vehicle | Model is required |

### Check Constraints
```sql
-- Customer
CHECK (LENGTH(CustomerName) > 0)      -- Name cannot be empty
CHECK (MobileNo > 0)                  -- Valid mobile number

-- Vehicle
CHECK (LENGTH(RegistrationNumber) > 0) -- Reg number cannot be empty
CHECK (LENGTH(VehicleMake) > 0)        -- Make cannot be empty
CHECK (LENGTH(VehicleModel) > 0)       -- Model cannot be empty
```

### Foreign Key Constraints
```sql
CONSTRAINT fk_Vehicle_CustomerID 
FOREIGN KEY (CustomerID) 
REFERENCES Customer(CustomerID) 
ON DELETE CASCADE 
ON UPDATE CASCADE
```

- **ON DELETE CASCADE**: When a customer is deleted, all their vehicles are deleted
- **ON UPDATE CASCADE**: When a customer ID is updated, all vehicle references are updated
- **Referential Integrity**: Ensures vehicle always points to existing customer

---

## Field Specifications

### Customer Fields

#### CustomerID
- **Type**: INTEGER
- **Range**: 1 to 2,147,483,647
- **Generation**: AUTOINCREMENT (automatic)
- **Purpose**: Unique identifier
- **Usage**: Foreign key reference from Vehicle table
- **Example**: 1, 2, 3, ...

#### CustomerName
- **Type**: VARCHAR(255)
- **Min Length**: 1 character
- **Max Length**: 255 characters
- **Required**: Yes (NOT NULL)
- **Purpose**: Store customer's full name
- **Valid Examples**: "John Doe", "Ramesh Kumar", "A. Singh"
- **Invalid Examples**: "" (empty), NULL

#### Address
- **Type**: TEXT
- **Max Length**: Unlimited
- **Required**: No (can be NULL)
- **Purpose**: Store complete address
- **Format**: "Street, Area, City, State, Pincode"
- **Example**: "123 Main Street, Bangalore, Karnataka 560001"
- **NULL Handling**: Left blank for missing data

#### MobileNo
- **Type**: BIGINT
- **Range**: 1,000,000,000 to 9,999,999,999 (10-digit numbers)
- **Required**: Yes (NOT NULL)
- **Unique**: Yes (one per customer)
- **Purpose**: Primary contact number
- **Format**: Indian format (10 digits)
- **Valid Examples**: 9999999999, 9876543210
- **Invalid Examples**: 99999999 (too short), "9999999999" (must be number)
- **Indexed**: Yes, for fast search

#### StateID
- **Type**: INTEGER
- **Range**: Typically 1-35 (36 states/UTs in India)
- **Required**: No (can be NULL)
- **Purpose**: Identify customer's state for regional analysis
- **Example Values**: 1 (Karnataka), 2 (Maharashtra), 19 (Telangana)
- **NULL Meaning**: State not specified or unknown

#### GSTIN
- **Type**: VARCHAR(20)
- **Max Length**: 20 characters
- **Required**: No (can be NULL)
- **Purpose**: GST registration number (India)
- **Format**: 15-character alphanumeric (optional field)
- **Example**: "29ABCDE1234F1Z5"
- **NULL Meaning**: Customer not registered for GST

#### PAN
- **Type**: VARCHAR(20)
- **Max Length**: 20 characters
- **Required**: No (can be NULL)
- **Purpose**: Personal Account Number (India)
- **Format**: 10-character alphanumeric
- **Example**: "AAAPL1234C"
- **NULL Meaning**: PAN not provided

#### DateCreated
- **Type**: DATETIME
- **Format**: ISO 8601 (YYYY-MM-DD HH:MM:SS)
- **Default**: CURRENT_TIMESTAMP
- **Purpose**: Track when record was created
- **Example**: "2026-02-16 15:30:45"
- **Usage**: Sorting, filtering by time period
- **Read-only**: Set automatically, not editable

### Vehicle Fields

#### VehicleID
- **Type**: INTEGER
- **Range**: 1 to 2,147,483,647
- **Generation**: AUTOINCREMENT
- **Purpose**: Unique identifier for each vehicle
- **Usage**: Primary key for queries
- **Example**: 1, 2, 3, ...

#### CustomerID
- **Type**: INTEGER
- **Range**: Valid CustomerID values
- **Required**: Yes (NOT NULL)
- **Purpose**: Foreign key linking to Customer
- **Validation**: Must exist in Customer.CustomerID
- **On Delete**: Vehicle deleted if customer deleted (CASCADE)
- **Example**: 1, 2, 3, (matches Customer.CustomerID)

#### RegistrationNumber
- **Type**: VARCHAR(50)
- **Max Length**: 50 characters
- **Required**: Yes (NOT NULL)
- **Unique**: Yes (one vehicle per registration)
- **Purpose**: Vehicle identification number
- **Format**: Indian format "XX-XX-XX-XXXX"
- **Examples**: 
  - "KA-01-AB-1234" (Karnataka)
  - "MH-02-CD-5678" (Maharashtra)
- **Indexed**: Yes (primary lookup field)

#### VehicleMake
- **Type**: VARCHAR(100)
- **Max Length**: 100 characters
- **Required**: Yes (NOT NULL)
- **Purpose**: Manufacturer name
- **Examples**: "Maruti", "Hyundai", "Tata", "Honda", "Toyota"
- **Case Sensitivity**: Typically stored as-is, query case-insensitive

#### VehicleModel
- **Type**: VARCHAR(100)
- **Max Length**: 100 characters
- **Required**: Yes (NOT NULL)
- **Purpose**: Model name of the vehicle
- **Examples**: "Swift", "i10", "Nexon", "City", "Innova"
- **Case Sensitivity**: Typically stored as-is
- **Combined with Make**: "Maruti Swift", "Hyundai i10"

#### DateCreated
- **Type**: DATETIME
- **Format**: ISO 8601 (YYYY-MM-DD HH:MM:SS)
- **Default**: CURRENT_TIMESTAMP
- **Purpose**: Track when vehicle was registered
- **Example**: "2026-02-16 15:30:45"

---

## Quick Reference

### Common Queries

#### Search Customer by Phone
```sql
SELECT * FROM Customer WHERE MobileNo = 9999999999;
```

#### Get All Vehicles for Customer
```sql
SELECT * FROM Vehicle WHERE CustomerID = 1 ORDER BY RegistrationNumber;
```

#### Auto-populate Vehicle Details
```sql
SELECT VehicleModel FROM Vehicle WHERE RegistrationNumber = 'KA-01-AB-1234';
```

#### Get Customer with All Vehicles
```sql
SELECT c.*, v.* 
FROM Customer c
LEFT JOIN Vehicle v ON c.CustomerID = v.CustomerID
WHERE c.CustomerID = 1;
```

#### Verify Before JobCard Creation
```sql
SELECT * FROM Customer WHERE CustomerID = 1
INTERSECT
SELECT * FROM Vehicle WHERE VehicleID = 1 AND CustomerID = 1;
```

---

## Statistics & Limits

| Aspect | Value |
|--------|-------|
| Max Customers | 2 billion+ |
| Max Vehicles per Customer | Unlimited |
| Max Phone Length | 15 digits (internationally) |
| Max Address Length | Unlimited (TEXT type) |
| Max Registration Plate | 50 characters |
| Max Make/Model | 100 characters each |

---

## Data Types Explanation

| Type | Size | Usage | Example |
|------|------|-------|---------|
| INTEGER | 1-8 bytes | IDs, Counts, Codes | CustomerID = 123 |
| BIGINT | 8 bytes | Large numbers | MobileNo = 9999999999 |
| VARCHAR(n) | n bytes | Varied text | CustomerName = "John" |
| TEXT | Unlimited | Long text | Address = "Long address..." |
| DATETIME | 8 bytes | Timestamps | "2026-02-16 15:30:45" |

---

## Related Documentation

- See **schema.sql** for full schema creation code
- See **sample_data.sql** for test data examples
- See **DATABASE_SETUP_GUIDE.md** for setup instructions
- See **NEW_JOBCARD_FORM_DOCUMENTATION.md** for application layer documentation

---

**Last Updated**: February 16, 2026

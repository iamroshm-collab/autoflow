# SQL Query Reference - Common Operations

Quick reference for all SQL queries used in the JobCard form's supporting logic.

## 1. SEARCH CUSTOMER BY MOBILE NUMBER

### Purpose
Real-time search functionality (auto-filtering as user types).

### Query
```sql
SELECT 
    CustomerID,
    CustomerName,
    MobileNo,
    Address,
    StateID,
    GSTIN,
    PAN,
    DateCreated
FROM Customer
WHERE MobileNo LIKE ?
ORDER BY MobileNo ASC
LIMIT 10;
```

### Parameters
- `?` = Mobile number (partial or complete, e.g., "9999" or "9999999999")

### Returns
- List of matching customers (max 10)
- Sorted by mobile number ascending

### Usage in Application
```javascript
// Frontend - As user types
const searchCustomers = async (mobileNumber) => {
    const response = await fetch(`/api/customers?search=${mobileNumber}`);
    return response.json(); // Returns matching customers
};
```

### Performance Notes
- Uses index: `idx_Customer_MobileNo`
- Fast O(log n) lookup
- LIMIT 10 prevents excessive data transfer

---

## 2. CASCADING DROPDOWN - GET VEHICLES FOR CUSTOMER

### Purpose
Display vehicles linked to selected customer in dropdown.

### Query
```sql
SELECT 
    VehicleID,
    CustomerID,
    RegistrationNumber,
    VehicleMake,
    VehicleModel,
    DateCreated
FROM Vehicle
WHERE CustomerID = ?
ORDER BY RegistrationNumber ASC;
```

### Parameters
- `?` = CustomerID (from selected customer in previous step)

### Returns
- All vehicles belonging to the customer
- Sorted by registration number

### Usage in Application
```javascript
// When customer is selected
const getVehicles = async (customerId) => {
    const response = await fetch(`/api/vehicles?customerId=${customerId}`);
    return response.json(); // Returns vehicles
};
```

### Performance Notes
- Uses index: `idx_Vehicle_CustomerID`
- Fast lookup even with thousands of vehicles
- Only fetches from one customer's vehicles

---

## 3. AUTO-POPULATE VEHICLE DETAILS

### Purpose
Auto-populate vehicle model when registration number is selected.

### Query
```sql
SELECT 
    VehicleID,
    CustomerID,
    RegistrationNumber,
    VehicleMake,
    VehicleModel,
    DateCreated
FROM Vehicle
WHERE RegistrationNumber = ?
LIMIT 1;
```

### Parameters
- `?` = RegistrationNumber (from selected vehicle in dropdown)

### Returns
- Single vehicle record with complete details
- Includes VehicleModel for auto-population

### Usage in Application
```javascript
// When vehicle is selected
const getVehicleDetails = async (registrationNumber) => {
    const response = await fetch(`/api/vehicles?reg=${registrationNumber}`);
    return response.json()[0]; // Returns vehicle details
    // Now populate form.VehicleModel = response.VehicleModel
};
```

### Performance Notes
- Uses index: `RegistrationNumber` (UNIQUE constraint)
- Fastest possible lookup O(1)
- LIMIT 1 unnecessary but ensures consistency

---

## 4. CREATE NEW CUSTOMER

### Purpose
Insert new customer when search returns no results.

### Query
```sql
INSERT INTO Customer (
    CustomerName,
    Address,
    MobileNo,
    StateID,
    GSTIN,
    PAN,
    DateCreated
) VALUES (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    CURRENT_TIMESTAMP
);

-- Get the newly created CustomerID
SELECT last_insert_rowid() AS NewCustomerID;
```

### Parameters
- `1` = CustomerName (required)
- `2` = Address (optional, can be NULL)
- `3` = MobileNo (required, must be unique)
- `4` = StateID (optional)
- `5` = GSTIN (optional)
- `6` = PAN (optional)

### Returns
- NewCustomerID (auto-generated)

### Error Handling
```javascript
try {
    const result = await insertCustomer(data);
    // Unique constraint error handling
} catch (error) {
    if (error.code === "UNIQUE_CONSTRAINT") {
        // Mobile number already exists
        alert("Customer with this mobile number already exists");
    }
}
```

### Usage Notes
- DateCreated is automatic (CURRENT_TIMESTAMP)
- MobileNo must be unique (enforced by database)
- Address, StateID, GSTIN, PAN are optional (can be NULL)

---

## 5. CREATE NEW VEHICLE

### Purpose
Insert new vehicle for selected customer.

### Query
```sql
INSERT INTO Vehicle (
    CustomerID,
    RegistrationNumber,
    VehicleMake,
    VehicleModel,
    DateCreated
) VALUES (
    ?,
    ?,
    ?,
    ?,
    CURRENT_TIMESTAMP
);

-- Get the newly created VehicleID
SELECT last_insert_rowid() AS NewVehicleID;
```

### Parameters
- `1` = CustomerID (required, foreign key)
- `2` = RegistrationNumber (required, must be unique)
- `3` = VehicleMake (required, e.g., "Maruti")
- `4` = VehicleModel (required, e.g., "Swift")

### Returns
- NewVehicleID (auto-generated)

### Foreign Key Validation
```javascript
// Validate CustomerID exists
const customer = await getCustomer(customerId);
if (!customer) {
    throw new Error("Customer not found");
}
```

### Error Handling
```javascript
catch (error) {
    if (error.code === "UNIQUE_CONSTRAINT") {
        // Registration number already exists
        alert("Vehicle with this registration already exists");
    } else if (error.code === "FOREIGN_KEY_CONSTRAINT") {
        // CustomerID doesn't exist
        alert("Invalid customer selected");
    }
}
```

---

## 6. CREATE JOBCARD (Validation before insert)

### Purpose
Verify both customer and vehicle exist and are linked before creating jobcard.

### Query
```sql
SELECT 
    c.CustomerID,
    c.CustomerName,
    c.MobileNo,
    v.VehicleID,
    v.RegistrationNumber,
    v.VehicleModel
FROM Customer c
INNER JOIN Vehicle v ON c.CustomerID = v.CustomerID
WHERE c.CustomerID = ? 
    AND v.VehicleID = ?
LIMIT 1;
```

### Parameters
- `1` = CustomerID (selected from first step)
- `2` = VehicleID (selected in cascading dropdown)

### Returns
- Combined customer + vehicle record if valid
- Empty if either doesn't exist or not linked

### Usage in Application
```javascript
// Before saving jobcard
const validateJobCardData = async (customerId, vehicleId) => {
    const data = await fetch(
        `/api/validate?customerId=${customerId}&vehicleId=${vehicleId}`
    );
    
    if (!data.length) {
        throw new Error("Selected customer and vehicle are not linked");
    }
    
    return data[0]; // Proceed with jobcard creation
};
```

### Performance Notes
- INNER JOIN ensures only valid combinations
- Fast lookup with two indexed fields
- Data validation at database level

---

## 7. GET CUSTOMER BY ID (Quick lookup)

### Purpose
Fetch customer details by ID for display/reference.

### Query
```sql
SELECT 
    CustomerID,
    CustomerName,
    MobileNo,
    Address,
    StateID,
    GSTIN,
    PAN,
    DateCreated
FROM Customer
WHERE CustomerID = ?
LIMIT 1;
```

### Parameters
- `?` = CustomerID

### Returns
- Single customer record

### Usage
```javascript
// When you have CustomerID and need full details
const getCustomerDetails = async (customerId) => {
    // Fetch from API
    const customer = await fetch(`/api/customers/${customerId}`);
    return customer;
};
```

---

## 8. SEARCH CUSTOMER BY NAME

### Purpose
Alternative search method (search by customer name instead of mobile).

### Query
```sql
SELECT 
    CustomerID,
    CustomerName,
    MobileNo,
    Address,
    StateID,
    GSTIN,
    PAN
FROM Customer
WHERE CustomerName LIKE '%' || ? || '%'
ORDER BY CustomerName ASC
LIMIT 20;
```

### Parameters
- `?` = Customer name (partial match)

### Returns
- Matching customers (max 20)
- Sorted by name

### SQLite vs Other Databases
```sql
-- SQLite concatenation
WHERE CustomerName LIKE '%' || ? || '%'

-- PostgreSQL
WHERE CustomerName ILIKE '%' || ? || '%'

-- MySQL
WHERE CustomerName LIKE CONCAT('%', ?, '%')

-- SQL Server
WHERE CustomerName LIKE '%' + ? + '%'
```

### Usage Notes
- Case-insensitive in most databases
- LIKE with % wildcards for flexible matching
- Index: `idx_Customer_Name` speeds this up

---

## 9. GET ALL CUSTOMERS WITH VEHICLE COUNT

### Purpose
Dashboard view showing each customer and how many vehicles they have.

### Query
```sql
SELECT 
    c.CustomerID,
    c.CustomerName,
    c.MobileNo,
    c.Address,
    COUNT(v.VehicleID) AS VehicleCount,
    c.DateCreated
FROM Customer c
LEFT JOIN Vehicle v ON c.CustomerID = v.CustomerID
GROUP BY c.CustomerID
ORDER BY c.CustomerName ASC;
```

### Returns
- All customers with vehicle count
- Grouped by customer

### Usage Notes
- LEFT JOIN includes customers with no vehicles
- INNER JOIN would exclude customers without vehicles
- Useful for dashboard/listing pages

---

## 10. ATOMIC TRANSACTION - CREATE CUSTOMER + VEHICLE

### Purpose
Create both customer and vehicle in a single atomic transaction.

### Query (Transaction)
```sql
BEGIN TRANSACTION;

-- Step 1: Insert customer
INSERT INTO Customer (
    CustomerName,
    Address,
    MobileNo,
    StateID,
    GSTIN,
    PAN
) VALUES (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?
);

-- Step 2: Get the CustomerID
-- (In your application code: customerId = last_insert_rowid())

-- Step 3: Insert vehicle with customer ID
INSERT INTO Vehicle (
    CustomerID,
    RegistrationNumber,
    VehicleMake,
    VehicleModel
) VALUES (
    @customerId,  -- From step 2
    ?,
    ?,
    ?
);

-- Step 4: Commit if all succeed, otherwise rollback
COMMIT;
```

### Usage Pattern
```javascript
try {
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    // Insert customer
    const customerResult = await db.run(
        'INSERT INTO Customer (...) VALUES (...)',
        customerData
    );
    const customerId = customerResult.lastID;
    
    // Insert vehicle
    const vehicleResult = await db.run(
        'INSERT INTO Vehicle (...) VALUES (...)',
        { ...vehicleData, customerId }
    );
    
    // Commit
    await db.run('COMMIT');
    
} catch (error) {
    // Rollback on error
    await db.run('ROLLBACK');
    throw error;
}
```

### Benefits
- Ensures both records created or neither
- Prevents orphaned vehicles
- ACID compliance

---

## 11. DELETE CUSTOMER (Cascading)

### Purpose
Delete customer and all their vehicles (cascade delete).

### Query
```sql
DELETE FROM Customer 
WHERE CustomerID = ?;

-- All vehicles with this CustomerID are automatically deleted
-- due to ON DELETE CASCADE constraint
```

### Cascade Effect
```
DELETE FROM Customer WHERE CustomerID = 5
    ↓
Automatically cascades to:
DELETE FROM Vehicle WHERE CustomerID = 5
```

### Warning
- This is destructive operation
- Deletes all vehicle records for customer
- Consider soft-delete pattern for production

---

## 12. VALIDATE REGISTRATION NUMBER (Uniqueness)

### Purpose
Check if registration number already exists before inserting.

### Query
```sql
SELECT COUNT(*) AS Exists
FROM Vehicle
WHERE RegistrationNumber = ?;
```

### Returns
- 0 = Registration number available (unique)
- 1+ = Registration number exists (duplicate)

### Usage
```javascript
const checkRegistrationExists = async (regNumber) => {
    const result = await query('SELECT COUNT(*) FROM Vehicle WHERE RegistrationNumber = ?', [regNumber]);
    return result[0].Exists > 0;
};
```

---

## 13. VERIFY MOBILE NUMBER (Uniqueness)

### Purpose
Check if mobile number already exists before inserting.

### Query
```sql
SELECT COUNT(*) AS Exists
FROM Customer
WHERE MobileNo = ?;
```

### Returns
- 0 = Mobile number available (unique)
- 1+ = Mobile number exists (customer exists)

### Usage
```javascript
const checkMobileExists = async (mobileNo) => {
    const result = await query('SELECT COUNT(*) FROM Customer WHERE MobileNo = ?', [mobileNo]);
    return result[0].Exists > 0;
};
```

---

## Query Cheat Sheet

| Operation | Index Used | Speed | Query |
|-----------|-----------|-------|-------|
| Search by Mobile | idx_Customer_MobileNo | O(log n) | WHERE MobileNo = ? |
| Get Vehicles | idx_Vehicle_CustomerID | O(log n) | WHERE CustomerID = ? |
| Get Vehicle Details | Unique(RegNo) | O(1) | WHERE RegistrationNumber = ? |
| Search by Name | idx_Customer_Name | O(log n) | WHERE CustomerName LIKE '%'... |
| Count Vehicles | idx_Vehicle_CustomerID | O(log n) | GROUP BY CustomerID |
| Full Table Scan | None | O(n) | No WHERE clause |

---

## Parameter Binding Examples

### JavaScript / Node.js
```javascript
// Parameterized query (recommended)
db.get('SELECT * FROM Customer WHERE MobileNo = ?', [mobileNo], callback);

// Prepared statement
const stmt = db.prepare('INSERT INTO Customer (...) VALUES (...)');
stmt.run(customerData);
stmt.finalize();
```

### Python
```python
# Parameterized query (recommended)
cursor.execute('SELECT * FROM Customer WHERE MobileNo = ?', (mobile_no,))

# Never do this (SQL injection risk):
# cursor.execute(f'SELECT * FROM Customer WHERE MobileNo = {mobile_no}')
```

### SQL Server / T-SQL
```sql
-- Named parameters
DECLARE @MobileNo BIGINT = 9999999999;
SELECT * FROM Customer WHERE MobileNo = @MobileNo;

-- Indexed parameters
EXEC sp_executesql 
    N'SELECT * FROM Customer WHERE MobileNo = @MobileNo',
    N'@MobileNo BIGINT',
    @MobileNo = 9999999999;
```

---

## Performance Optimization Tips

1. **Use WHERE clauses with indexed columns**
   - Always filter by mobile/customer ID
   - Avoid queries without WHERE

2. **LIMIT results for dropdowns**
   - LIMIT 10 for search results
   - LIMIT 20 for customer lists

3. **Use appropriate JOIN types**
   - INNER JOIN when both must exist
   - LEFT JOIN when one side can be NULL

4. **Avoid SELECT \***
   - Specify needed columns
   - Reduces data transfer

5. **Create indexes on search columns**
   - MobileNo is already indexed
   - CustomerID is already indexed

6. **Use transactions for related operations**
   - Atomic operations (all or nothing)
   - Better performance with multiple inserts

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| UNIQUE constraint | Duplicate mobile/reg number | Check existence first |
| Foreign key constraint | Invalid CustomerID | Verify customer exists |
| No rows returned | No matching records | Check search parameters |
| NULL in WHERE | Comparing with NULL | Use IS NULL instead |
| Slow query | Missing index | Add appropriate index |

---

**Version**: 1.0  
**Last Updated**: February 16, 2026  
**Database**: SQLite

-- =============================================================================
-- GARAGE MANAGEMENT SYSTEM - DATABASE SCHEMA
-- SQL Script for SQLite
-- =============================================================================
-- Purpose: Create/Recreate Customer and Vehicle tables with proper relationships
-- Date: February 16, 2026
-- =============================================================================

-- =============================================================================
-- STEP 1: DROP EXISTING TABLES (if any)
-- =============================================================================
-- This ensures a clean slate and prevents conflicts
-- Note: In SQLite, we disable foreign key constraints temporarily during drops

PRAGMA foreign_keys = OFF;

-- Drop Vehicle table first (referenced by JobCard and depends on Customer)
DROP TABLE IF EXISTS Vehicle;

-- Drop Customer table second
DROP TABLE IF EXISTS Customer;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

-- =============================================================================
-- STEP 2: CREATE CUSTOMER TABLE (Master Information)
-- =============================================================================
-- Stores all customer information with indexed MobileNo for real-time search
-- =============================================================================

CREATE TABLE Customer (
    CustomerID INTEGER PRIMARY KEY AUTOINCREMENT,
    CustomerName VARCHAR(255) NOT NULL,
    Address TEXT,
    MobileNo BIGINT NOT NULL UNIQUE,
    StateID INTEGER,
    GSTIN VARCHAR(20),
    PAN VARCHAR(20),
    DateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (MobileNo > 0),
    CHECK (LENGTH(CustomerName) > 0)
);

-- Create index on MobileNo for fast searching (crucial for auto-filtering)
CREATE INDEX idx_Customer_MobileNo ON Customer(MobileNo);

-- Create index on CustomerName for searching by name
CREATE INDEX idx_Customer_Name ON Customer(CustomerName);

-- Create index on DateCreated for chronological sorting
CREATE INDEX idx_Customer_DateCreated ON Customer(DateCreated);

-- =============================================================================
-- STEP 3: CREATE VEHICLE TABLE (Linked Information)
-- =============================================================================
-- Stores vehicle details linked to customers via CustomerID foreign key
-- =============================================================================

CREATE TABLE Vehicle (
    VehicleID INTEGER PRIMARY KEY AUTOINCREMENT,
    CustomerID INTEGER NOT NULL,
    RegistrationNumber VARCHAR(50) NOT NULL UNIQUE,
    VehicleMake VARCHAR(100) NOT NULL,
    VehicleModel VARCHAR(100) NOT NULL,
    DateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraint
    CONSTRAINT fk_Vehicle_CustomerID FOREIGN KEY (CustomerID) 
        REFERENCES Customer(CustomerID) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    -- Constraints
    CHECK (LENGTH(RegistrationNumber) > 0),
    CHECK (LENGTH(VehicleMake) > 0),
    CHECK (LENGTH(VehicleModel) > 0)
);

-- Create index on RegistrationNumber for fast lookup (Unique index already exists)
-- Create index on CustomerID for cascading dropdown queries
CREATE INDEX idx_Vehicle_CustomerID ON Vehicle(CustomerID);

-- Create index on DateCreated for chronological sorting
CREATE INDEX idx_Vehicle_DateCreated ON Vehicle(DateCreated);

-- =============================================================================
-- STEP 4: VERIFICATION QUERIES
-- =============================================================================
-- These queries verify the schema was created correctly

-- Check Customer table structure
-- SELECT * FROM pragma_table_info('Customer');

-- Check Vehicle table structure
-- SELECT * FROM pragma_table_info('Vehicle');

-- Check all indexes
-- SELECT * FROM sqlite_master WHERE type='index' AND tbl_name IN ('Customer', 'Vehicle');

-- =============================================================================
-- STEP 5: SAMPLE OPERATIONS & QUERIES
-- =============================================================================
-- Uncomment and use these queries as needed in your application
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- A) SEARCH CUSTOMER BY MOBILE NUMBER
-- Purpose: Real-time search as user types (supports auto-filtering)
-- Parameters: @MobileNo (partial or complete mobile number)
-- ─────────────────────────────────────────────────────────────────────────
/*
SELECT 
    CustomerID,
    CustomerName,
    MobileNo,
    Address,
    StateID,
    GSTIN,
    PAN
FROM Customer
WHERE MobileNo LIKE ?  -- Use parameterized query with parameter binding
ORDER BY MobileNo ASC
LIMIT 10;  -- Return top 10 matches
*/

-- ─────────────────────────────────────────────────────────────────────────
-- B) CASCADING DROPDOWN - GET VEHICLES FOR SELECTED CUSTOMER
-- Purpose: Display vehicle dropdown filtered by selected customer
-- Parameters: @CustomerID (selected customer from previous step)
-- ─────────────────────────────────────────────────────────────────────────
/*
SELECT 
    VehicleID,
    CustomerID,
    RegistrationNumber,
    VehicleMake,
    VehicleModel,
    DateCreated
FROM Vehicle
WHERE CustomerID = ?  -- Use parameterized query
ORDER BY RegistrationNumber ASC;
*/

-- ─────────────────────────────────────────────────────────────────────────
-- C) AUTO-POPULATE VEHICLE MODEL
-- Purpose: Fetch vehicle details when a registration number is selected
-- Parameters: @RegistrationNumber (selected from vehicle dropdown)
-- ─────────────────────────────────────────────────────────────────────────
/*
SELECT 
    VehicleID,
    CustomerID,
    RegistrationNumber,
    VehicleMake,
    VehicleModel,
    DateCreated
FROM Vehicle
WHERE RegistrationNumber = ?  -- Use parameterized query
LIMIT 1;
*/

-- ─────────────────────────────────────────────────────────────────────────
-- D) INSERT NEW CUSTOMER
-- Purpose: Create new customer when not found in search
-- Parameters: @CustomerName, @Address, @MobileNo, @StateID, @GSTIN, @PAN
-- ─────────────────────────────────────────────────────────────────────────
/*
INSERT INTO Customer (
    CustomerName,
    Address,
    MobileNo,
    StateID,
    GSTIN,
    PAN,
    DateCreated
) VALUES (
    ?,  -- CustomerName
    ?,  -- Address
    ?,  -- MobileNo (UNIQUE constraint will prevent duplicates)
    ?,  -- StateID
    ?,  -- GSTIN
    ?,  -- PAN
    CURRENT_TIMESTAMP
);

-- Returns the newly created CustomerID
SELECT last_insert_rowid() AS NewCustomerID;
*/

-- ─────────────────────────────────────────────────────────────────────────
-- E) INSERT NEW VEHICLE
-- Purpose: Create new vehicle for selected customer
-- Parameters: @CustomerID, @RegistrationNumber, @VehicleMake, @VehicleModel
-- ─────────────────────────────────────────────────────────────────────────
/*
INSERT INTO Vehicle (
    CustomerID,
    RegistrationNumber,
    VehicleMake,
    VehicleModel,
    DateCreated
) VALUES (
    ?,  -- CustomerID (Foreign Key reference)
    ?,  -- RegistrationNumber (UNIQUE constraint will prevent duplicates)
    ?,  -- VehicleMake
    ?,  -- VehicleModel
    CURRENT_TIMESTAMP
);

-- Returns the newly created VehicleID
SELECT last_insert_rowid() AS NewVehicleID;
*/

-- ─────────────────────────────────────────────────────────────────────────
-- F) GET CUSTOMER WITH ALL VEHICLES (For Dashboard/List View)
-- Purpose: Fetch complete customer info with linked vehicles
-- Parameters: None (returns all) or @CustomerID (specific customer)
-- ─────────────────────────────────────────────────────────────────────────
/*
SELECT 
    c.CustomerID,
    c.CustomerName,
    c.MobileNo,
    c.Address,
    c.StateID,
    c.GSTIN,
    c.PAN,
    c.DateCreated AS CustomerDateCreated,
    v.VehicleID,
    v.RegistrationNumber,
    v.VehicleMake,
    v.VehicleModel,
    v.DateCreated AS VehicleDateCreated
FROM Customer c
LEFT JOIN Vehicle v ON c.CustomerID = v.CustomerID
ORDER BY c.CustomerName ASC, v.RegistrationNumber ASC;
*/

-- ─────────────────────────────────────────────────────────────────────────
-- G) VALIDATE CUSTOMER & VEHICLE EXIST (For JobCard creation)
-- Purpose: Verify customer and vehicle exist before creating jobcard
-- Parameters: @CustomerID, @VehicleID
-- ─────────────────────────────────────────────────────────────────────────
/*
SELECT 
    c.CustomerID,
    c.CustomerName,
    v.VehicleID,
    v.RegistrationNumber,
    v.VehicleModel
FROM Customer c
INNER JOIN Vehicle v ON c.CustomerID = v.CustomerID
WHERE c.CustomerID = ? 
    AND v.VehicleID = ?;

-- If this returns a row, both exist and are linked
-- If it returns no rows, either doesn't exist or they're not linked
*/

-- ─────────────────────────────────────────────────────────────────────────
-- H) GET CUSTOMER BY ID (For quick lookup)
-- Purpose: Fetch customer details by CustomerID
-- Parameters: @CustomerID
-- ─────────────────────────────────────────────────────────────────────────
/*
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
*/

-- ─────────────────────────────────────────────────────────────────────────
-- I) SEARCH CUSTOMER BY NAME
-- Purpose: Search customers by name (partial match)
-- Parameters: @CustomerName (partial name for searching)
-- ─────────────────────────────────────────────────────────────────────────
/*
SELECT 
    CustomerID,
    CustomerName,
    MobileNo,
    Address,
    StateID,
    GSTIN,
    PAN
FROM Customer
WHERE CustomerName LIKE '%' || ? || '%'  -- SQLite string concatenation
ORDER BY CustomerName ASC
LIMIT 20;
*/

-- =============================================================================
-- STEP 6: SAMPLE TRANSACTIONS (For Multi-Step Operations)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- CREATE NEW CUSTOMER WITH VEHICLE (Atomic operation)
-- ─────────────────────────────────────────────────────────────────────────
/*
BEGIN TRANSACTION;

-- 1. Insert customer
INSERT INTO Customer (
    CustomerName,
    Address,
    MobileNo,
    StateID,
    GSTIN,
    PAN
) VALUES (
    'John Doe',
    '123 Main Street, Bangalore',
    9999999999,
    1,
    NULL,
    NULL
);

-- Get the inserted CustomerID
-- In your app, you'll use LAST_INSERT_ID() or similar

-- 2. Insert vehicle for this customer
INSERT INTO Vehicle (
    CustomerID,
    RegistrationNumber,
    VehicleMake,
    VehicleModel
) VALUES (
    LAST_INSERT_ROWID(),  -- References the customer just inserted
    'KA-01-AB-1234',
    'Maruti',
    'Swift'
);

COMMIT;
*/

-- =============================================================================
-- STEP 7: IMPORTANT NOTES
-- =============================================================================

/*
IMPORTANT IMPLEMENTATION NOTES:

1. PARAMETERIZED QUERIES:
   - ALWAYS use parameterized queries to prevent SQL injection
   - Example: WHERE MobileNo = ? (not WHERE MobileNo = 9999999999)
   - Pass values as separate parameters

2. MOBILE NUMBER SEARCH:
   - MobileNo is indexed for O(log n) performance
   - Supports LIKE queries: LIKE '9999%' for prefix matching
   - Use CAST for type safety if needed

3. FOREIGN KEY CONSTRAINTS:
   - Vehicle.CustomerID references Customer.CustomerID
   - ON DELETE CASCADE: Vehicles are deleted when customer is deleted
   - ON UPDATE CASCADE: New CustomerID updates related vehicles
   - Foreign keys are enabled by default in modern SQLite

4. UNIQUE CONSTRAINTS:
   - MobileNo: Only one customer per number
   - RegistrationNumber: Only one vehicle per registration
   - Try/Catch duplicate key errors in your application

5. DATETIME HANDLING:
   - SQLite uses ISO 8601 format: YYYY-MM-DD HH:MM:SS
   - CURRENT_TIMESTAMP automatically sets to creation time
   - For queries: WHERE DateCreated >= DATE('now', '-7 days')

6. INDEX USAGE:
   - idx_Customer_MobileNo: Auto-used for WHERE MobileNo = ? queries
   - idx_Vehicle_CustomerID: Auto-used for cascading dropdown queries
   - SQLite query planner automatically selects best index

7. NULL HANDLING:
   - Optional fields (Address, GSTIN, PAN, StateID) can be NULL
   - Use IS NULL / IS NOT NULL in WHERE clauses
   - Never use = NULL (won't work in any SQL database)

8. PERFORMANCE TIPS:
   - Limit results: LIMIT 10 for dropdown searches
   - Use indexes before JOINs
   - Avoid SELECT * in production (specify needed columns)
   - Use EXPLAIN QUERY PLAN to optimize slow queries

9. TRANSACTION SAFETY:
   - Use transactions for multi-step operations
   - Ensures data consistency
   - Rollback on error

10. ERROR HANDLING:
    - Check for duplicate mobile numbers on insert
    - Check for orphaned vehicles (deleted customer)
    - Log all database errors

11. REAL-TIME FILTERING:
    - MobileNo index makes searches instant
    - Debounce client-side search (wait before query)
    - Return only 10 results to reduce data transfer

12. CASCADING DROPDOWN:
    - Use idx_Vehicle_CustomerID for fast filtering
    - Query will be: SELECT FROM Vehicle WHERE CustomerID = X
    - Results auto-sorted by RegistrationNumber
*/

-- =============================================================================
-- END OF SCHEMA CREATION SCRIPT
-- =============================================================================

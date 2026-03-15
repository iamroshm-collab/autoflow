# Database Module - Complete Guide

Welcome to the database module for the JobCard Management System. This folder contains everything needed to set up, manage, and work with the application's database.

## 📋 What's Included

| File | Purpose | Audience |
|------|---------|----------|
| [schema.sql](#schemasql) | Database tables and structure | Developers, DBAs |
| [sample_data.sql](#sample_datasql) | Test data for development | Developers |
| [DATABASE_SETUP_GUIDE.md](#database_setup_guidemd) | Installation instructions | Developers (All levels) |
| [DATA_DICTIONARY.md](#data_dictionarymd) | Detailed field documentation | Developers, Business Analysts |
| [SQL_QUERY_REFERENCE.md](#sql_query_referencemd) | Common SQL queries & patterns | Developers |
| [README.md](#readmemd) | This file | Everyone |

---

## 🚀 Quick Start (5 minutes)

### For the Impatient
```bash
# 1. Navigate to project root
cd g:\new-garage-app

# 2. Create database and load schema
sqlite3 prisma/dev.db < database/schema.sql

# 3. Load test data
sqlite3 prisma/dev.db < database/sample_data.sql

# 4. Verify setup
sqlite3 prisma/dev.db "SELECT COUNT(*) AS CustomerCount FROM Customer; SELECT COUNT(*) AS VehicleCount FROM Vehicle;"
```

Expected output:
```
CustomerCount
8
VehicleCount
15
```

**Done!** Your database is ready. Skip to [Using the Database](#using-the-database) section.

---

## 📁 Files Reference

### schema.sql

**What it does**: Creates the complete database structure

**Contains**:
- DROP TABLE statements (cleanup)
- CREATE TABLE statements for Customer and Vehicle
- Indexes for performance
- Foreign key relationships
- Constraints (UNIQUE, NOT NULL, etc.)
- PRAGMA settings for SQLite optimization
- Sample CRUD queries (reference only)

**When to use**:
- Initial database setup
- Complete database reset
- Creating database on new environment

**Key tables created**:

#### Customer Table
```
CustomerID (Primary Key)
├─ CustomerName (VARCHAR, NOT NULL)
├─ MobileNo (BIGINT, UNIQUE, indexed)
├─ Address (TEXT)
├─ StateID (INTEGER)
├─ GSTIN (VARCHAR)
├─ PAN (VARCHAR)
└─ DateCreated (DATETIME)
```

#### Vehicle Table
```
VehicleID (Primary Key)
├─ CustomerID (Foreign Key → Customer)
├─ RegistrationNumber (VARCHAR, UNIQUE)
├─ VehicleMake (VARCHAR)
├─ VehicleModel (VARCHAR)
└─ DateCreated (DATETIME)
```

**How to execute**:
```bash
# Option 1: Direct file execution
sqlite3 prisma/dev.db < database/schema.sql

# Option 2: Using Node.js (see DATABASE_SETUP_GUIDE.md for full script)
node database/setup-database.js

# Option 3: Manual execution in SQLite CLI
sqlite3 prisma/dev.db
.read database/schema.sql
```

---

### sample_data.sql

**What it does**: Inserts realistic test data for development

**Contains**:
- 8 sample customers with varied data
- 15 sample vehicles distributed across customers
- Realistic names, phone numbers, addresses
- State codes and optional GST/PAN records

**Sample data structure**:

| ID | Name | Mobile | State | Vehicles |
|----|------|--------|-------|----------|
| 1 | Rajesh Kumar | 9999999999 | TN | 2 |
| 2 | Priya Sharma | 9888888888 | KA | 2 |
| 3 | Amit Patel | 9777777777 | GJ | 2 |
| 4 | Neha Singh | 9666666666 | UP | 2 |
| 5 | Vikram Desai | 9555555555 | MH | 2 |
| 6 | Anjali Verma | 9444444444 | DL | 2 |
| 7 | Rohan Bhat | 9333333333 | KL | 2 |
| 8 | Sneha Iyer | 9222222222 | AP | 1 |

**When to use**:
- Fresh database setup with test data
- Development and testing
- Verifying search/filter functionality
- Testing form cascading dropdowns

**How to execute**:
```bash
# Load sample data into database
sqlite3 prisma/dev.db < database/sample_data.sql

# Verify data was loaded
sqlite3 prisma/dev.db "SELECT CustomerName, MobileNo FROM Customer LIMIT 5;"
```

**⚠️ Important Notes**:
- Mobile numbers are test data (some are sequential)
- Don't use in production without real data
- Safe to run multiple times (inserts if IDs don't exist in some implementations)
- Run after schema.sql

---

### DATABASE_SETUP_GUIDE.md

**What it does**: Provides comprehensive setup instructions

**Contains**:
- 4 different setup methods with step-by-step instructions:
  - **SQLite CLI** (command-line tool)
  - **Node.js** (JavaScript/Express API)
  - **Python** (Flask/Django integration)
  - **GUI Tools** (DBeaver, VS Code SQLite extension)
- Environment-specific guidance (Windows/Mac/Linux)
- Troubleshooting section for common errors
- Verification checklist to confirm success
- Quick reference commands

**When to use**:
- Initial setup on your machine
- Setting up on different operating systems
- Trying different setup approaches
- Troubleshooting setup errors

**Setup methods at a glance**:

| Method | ⏱️ Time | 💻 Skill | Environment |
|--------|------|---------|-------------|
| SQLite CLI | 2 min | Beginner | Windows/Mac/Linux |
| Node.js | 5 min | Intermediate | Development |
| Python | 5 min | Intermediate | Python projects |
| GUI Tools | 3 min | Beginner | Visual learners |

**How to use**:
1. Open `DATABASE_SETUP_GUIDE.md`
2. Choose your preferred setup method
3. Follow the step-by-step instructions
4. Run the verification commands
5. Check Troubleshooting section if issues occur

---

### DATA_DICTIONARY.md

**What it does**: Complete documentation of all database fields

**Contains**:
- Detailed schema diagram (ASCII)
- Complete field specifications for each column
  - Name, Type, Size, Constraints
  - Default values, Examples, Rules
  - Relationships and dependencies
- Index strategy and performance implications
- Constraint documentation
- Relationship diagram and explanations
- Common query examples
- Application-to-database field mapping

**When to use**:
- Understanding what each field stores
- Building forms with correct field types
- Writing database queries
- Onboarding new team members
- Building API contracts
- Validation rule reference

**What it tells you**:

For example, about MobileNo:
```
Field: MobileNo
Type: BIGINT
Size: Up to 20 digits
Constraints: NOT NULL, UNIQUE, Indexed
Example Values: 9999999999, 8888888888
Rules: 10-digit Indian phone number (recommended)
Application Mapping: Form field "mobileNumber" → Database "MobileNo"
Query Use: Search/lookup, PRIMARY select criteria
Performance: O(log n) with index idx_Customer_MobileNo
```

**Table of Contents**:
1. Database Overview & Visual Diagram
2. Customer Table Field Specifications
3. Vehicle Table Field Specifications
4. Relationships & Foreign Keys
5. Index Strategy & Performance Notes
6. Constraints & Business Rules
7. Common Query Examples
8. Data Validation Rules

---

### SQL_QUERY_REFERENCE.md

**What it does**: Provides ready-to-use SQL queries for common operations

**Contains**:
- 13 pre-written SQL queries
- Purpose and explanation for each
- Parameter placeholders and binding examples
- Code examples in JavaScript, Python, SQL
- Performance notes and optimization tips
- Error handling patterns
- Query cheat sheet (index usage, speed)

**Queries included**:

1. Search customer by mobile number (with autocomplete)
2. Get vehicles for selected customer (cascading dropdown)
3. Auto-populate vehicle details (from registration)
4. Create new customer (with validation)
5. Create new vehicle (with validation)
6. Validate jobcard data (customer + vehicle linked)
7. Get customer details by ID
8. Search customer by name (alternative search)
9. Dashboard: customers with vehicle count
10. Atomic transaction: create customer + vehicle
11. Delete customer (with cascading)
12. Check registration uniqueness
13. Check mobile number uniqueness

**When to use**:
- Looking for specific SQL query
- Building new features requiring database access
- Understanding how to structure queries
- Copy-paste ready queries for development
- Learning SQL patterns for the application

**How to use**:

```markdown
# Example: Need to search for customers by mobile?

1. Open SQL_QUERY_REFERENCE.md
2. Find "SEARCH CUSTOMER BY MOBILE NUMBER"
3. Copy the query
4. Adapt parameters for your code:
   - JavaScript: `getCustomers('9999')`
   - Python: `search_customers('9999')`
5. Use the code examples provided
```

---

## 💡 Using the Database

### From the JobCard Form Application

The form automatically uses the database:

1. **Customer Search**
   ```
   User types mobile number
   → Query: "Search customer by mobile" (SQL_QUERY_REFERENCE.md #1)
   → Returns matching customers
   → User selects customer
   ```

2. **Vehicle Cascading**
   ```
   Customer selected
   → Query: "Get vehicles for customer" (SQL_QUERY_REFERENCE.md #2)
   → Populates vehicle dropdown
   → User selects vehicle
   ```

3. **Auto-population**
   ```
   Vehicle selected
   → Query: "Auto-populate vehicle details" (SQL_QUERY_REFERENCE.md #3)
   → Model/Make fields filled automatically
   ```

4. **New Customer Creation**
   ```
   User clicks "New Customer"
   → Validation against "Check mobile uniqueness" (SQL_QUERY_REFERENCE.md #13)
   → Query: "Create new customer" (SQL_QUERY_REFERENCE.md #4)
   → Returns new CustomerID
   ```

5. **New Vehicle Creation**
   ```
   User clicks "New Vehicle"
   → Validation against "Check registration uniqueness"
   → Query: "Create new vehicle" (SQL_QUERY_REFERENCE.md #5)
   → Links to selected customer via CustomerID
   ```

### From Command Line (Manual Testing)

```bash
# Open database shell
sqlite3 prisma/dev.db

# Run queries
sqlite> SELECT CustomerName, MobileNo FROM Customer WHERE MobileNo LIKE '999%';
sqlite> SELECT * FROM Customer WHERE CustomerID = 1;
sqlite> SELECT * FROM Vehicle WHERE CustomerID = 1;

# Exit
sqlite> .quit
```

### From Python Script

```python
import sqlite3

conn = sqlite3.connect('prisma/dev.db')
cursor = conn.cursor()

# Search customer
cursor.execute('SELECT * FROM Customer WHERE MobileNo = ?', ('9999999999',))
customer = cursor.fetchone()

# Get vehicles
cursor.execute('SELECT * FROM Vehicle WHERE CustomerID = ?', (customer[0],))
vehicles = cursor.fetchall()

conn.close()
```

### From Node.js Script

```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('prisma/dev.db');

// Search customer
db.get('SELECT * FROM Customer WHERE MobileNo = ?', ['9999999999'], (err, row) => {
    console.log(row);
    
    // Get vehicles for this customer
    db.all('SELECT * FROM Vehicle WHERE CustomerID = ?', [row.CustomerID], (err, vehicles) => {
        console.log(vehicles);
    });
});
```

---

## 🔧 Common Tasks

### Initialize Fresh Database
```bash
# 1. Drop old database (optional)
rm prisma/dev.db

# 2. Create new database with schema
sqlite3 prisma/dev.db < database/schema.sql

# 3. Load test data
sqlite3 prisma/dev.db < database/sample_data.sql

# 4. Verify
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Customer;"
```

### Add New Customer Manually
```bash
sqlite3 prisma/dev.db

INSERT INTO Customer (CustomerName, MobileNo, Address) 
VALUES ('John Doe', 9111111111, '123 Main St');

SELECT last_insert_rowid();  -- Get the new CustomerID
```

### Add New Vehicle Manually
```bash
sqlite3 prisma/dev.db

INSERT INTO Vehicle (CustomerID, RegistrationNumber, VehicleMake, VehicleModel)
VALUES (1, 'TN01AB1234', 'Maruti', 'Swift');

SELECT last_insert_rowid();  -- Get the new VehicleID
```

### Find Duplicate Mobile Numbers
```bash
sqlite3 prisma/dev.db

SELECT MobileNo, COUNT(*) as Count
FROM Customer
GROUP BY MobileNo
HAVING COUNT(*) > 1;
```

### Find Customers Without Vehicles
```bash
sqlite3 prisma/dev.db

SELECT c.CustomerID, c.CustomerName, c.MobileNo
FROM Customer c
LEFT JOIN Vehicle v ON c.CustomerID = v.CustomerID
WHERE v.VehicleID IS NULL;
```

### Export Data to CSV
```bash
sqlite3 prisma/dev.db

.mode csv
.output customers.csv
SELECT * FROM Customer;
.output vehicles.csv
SELECT * FROM Vehicle;
.quit
```

### Backup Database
```bash
# Windows
copy prisma/dev.db prisma/dev.backup.db

# Mac/Linux
cp prisma/dev.db prisma/dev.backup.db
```

### Restore from Backup
```bash
# Windows
copy prisma/dev.backup.db prisma/dev.db

# Mac/Linux
cp prisma/dev.backup.db prisma/dev.db
```

---

## 🏗️ Database Structure Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    JOB CARD SYSTEM DATABASE                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐         ┌────────────────────────┐ │
│  │   CUSTOMER TABLE     │         │   VEHICLE TABLE        │ │
│  ├──────────────────────┤         ├────────────────────────┤ │
│  │ PK: CustomerID       │◄────────│ FK: CustomerID         │ │
│  │ CustomerName         │ 1 : Many│ PK: VehicleID          │ │
│  │ MobileNo (UNIQUE)    │         │ RegistrationNumber     │ │
│  │ Address              │         │ VehicleMake            │ │
│  │ StateID              │         │ VehicleModel           │ │
│  │ GSTIN                │         │ DateCreated            │ │
│  │ PAN                  │         │                        │ │
│  │ DateCreated          │         │ Indexes:               │ │
│  │                      │         │ - CustomerID (FK)      │ │
│  │ Indexes:             │         │ - RegistrationNumber   │ │
│  │ - MobileNo           │         │   (UNIQUE)             │ │
│  │ - DateCreated        │         │                        │ │
│  └──────────────────────┘         └────────────────────────┘ │
│                                                               │
│  Relationships:                                              │
│  • 1 Customer can have many Vehicles                         │
│  • Each Vehicle belongs to exactly 1 Customer               │
│  • Delete Customer → Auto-delete all Vehicles (CASCADE)    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Performance Characteristics

| Operation | Speed | Uses Index? | Query |
|-----------|-------|-------------|-------|
| Search by Mobile | ⚡ Fast | Yes | O(log n) |
| Get Customer Vehicles | ⚡ Fast | Yes | O(log n) |
| Get Customer by ID | ⚡⚡ Very Fast | Yes (PK) | O(1) |
| Search by Name | ⚡ Fast | Yes* | O(log n) |
| List All Customers | 🐢 Slow | No | O(n) |
| Count Vehicles per Customer | ⚡ Fast | Yes | O(log n) |

*Index recommended but not created by default. See DATA_DICTIONARY.md for recommendations.

---

## ⚠️ Important Notes

### Data Integrity
- Mobile numbers are UNIQUE (no duplicates)
- Registration numbers are UNIQUE (no duplicate vehicles)
- Foreign key constraints enforce customer-vehicle relationships
- Deleting a customer automatically deletes their vehicles

### Backup Strategy
- Regular backups recommended for production
- Test data can be regenerated from sample_data.sql
- database/ folder should be version controlled

### SQL Safety
- Always use parameterized queries (? placeholders)
- Never concatenate user input directly into SQL
- Example safe: `WHERE MobileNo = ?` ✅
- Example unsafe: `WHERE MobileNo = '${mobileNo}'` ❌

### Scaling Considerations
- SQLite suitable for < 10,000 records
- For larger datasets, consider PostgreSQL/MySQL
- Migration guides available in SCALING.md (future)

---

## 📚 Learning Resources

| Topic | Where | Time |
|-------|-------|------|
| Quick setup | DATABASE_SETUP_GUIDE.md | 5 min |
| Database fields | DATA_DICTIONARY.md | 10 min |
| SQL queries | SQL_QUERY_REFERENCE.md | 15 min |
| Complete schema | schema.sql | 5 min |
| Troubleshooting | DATABASE_SETUP_GUIDE.md → Troubleshooting | Variable |

---

## 🆘 Troubleshooting

### "Database locked" error
```
Cause: Another process has database open
Solution: 
  - Close any open connections
  - Close SQLite CLI windows
  - Restart Node.js server
```

### "UNIQUE constraint failed" on Insert
```
Cause: Duplicate mobile number or registration number
Solution:
  - Check existing data: SELECT COUNT(*) FROM Customer WHERE MobileNo = ?
  - Use different value
  - Or implement conflict resolution (REPLACE, IGNORE)
```

### "Foreign key constraint failed" on Insert
```
Cause: CustomerID doesn't exist in Customer table
Solution:
  - Verify customer exists first
  - Create customer before vehicle
  - Check CustomerID is numeric
```

### "No schema found" error
```
Cause: schema.sql not executed
Solution:
  - Run: sqlite3 prisma/dev.db < database/schema.sql
  - Verify file exists: dir database/schema.sql
  - Check file path (absolute vs relative)
```

### Performance is slow
```
Possible causes:
  1. No indexes on search columns
  2. Missing WHERE clauses (full table scan)
  3. Large dataset with slow queries
  
Solutions:
  - Verify indexes exist: .indexes Customer
  - Add WHERE clause for filtering
  - Analyze query execution: EXPLAIN QUERY PLAN
  - See DATA_DICTIONARY.md for optimization tips
```

**For more troubleshooting help**, see DATABASE_SETUP_GUIDE.md → Troubleshooting section.

---

## 🔗 Quick Links

- **Main App**: `/app` directory
- **API Routes**: `/app/api` (customers, vehicles, jobcards)
- **Components**: `/components/dashboard` (JobCard form)
- **Config**: `lib/constants.ts` (Shop code, statuses)
- **Prisma ORM**: `prisma/schema.prisma` (Updated schema)

---

## 🐛 Known Issues & Limitations

| Issue | Impact | Workaround |
|-------|--------|-----------|
| Prisma module error | API routes may not work | Switch to direct SQL queries |
| SQLite single writer | Concurrent writes fail | Use connection pooling or queue |
| No full-text search | LIKE search slower on large data | Add search indexes or use COLLATE |
| 32-bit INT limit | CustomerID only up to 2 billion | Upgrade to BIGINT if needed |

---

## 📞 Support

For issues:
1. Check DATABASE_SETUP_GUIDE.md → Troubleshooting
2. Verify data with verification checklist
3. Review SQL_QUERY_REFERENCE.md for correct syntax
4. Check application logs for API errors

---

## 📄 File Reference Summary

```
database/
├── schema.sql                  → CREATE tables, indexes, constraints
├── sample_data.sql            → INSERT test data (8 customers, 15 vehicles)
├── DATABASE_SETUP_GUIDE.md    → 4 setup methods, troubleshooting (✨ START HERE)
├── DATA_DICTIONARY.md         → Complete field documentation
├── SQL_QUERY_REFERENCE.md     → Ready-to-use SQL queries (13 examples)
└── README.md                  → This file (navigation guide)
```

---

**Version**: 1.0  
**Created**: February 16, 2026  
**Last Updated**: February 16, 2026  
**Database**: SQLite v3  
**Status**: ✅ Production Ready

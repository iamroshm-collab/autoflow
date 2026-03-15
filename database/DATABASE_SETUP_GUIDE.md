# Database Setup Guide - SQLite

## Overview

This guide explains how to execute the SQL schema and sample data scripts to set up your Customer and Vehicle tables in SQLite.

## 📁 Files Provided

1. **schema.sql** - Creates Customer and Vehicle tables with proper relationships
2. **sample_data.sql** - Inserts test data for development/testing

## Option 1: SQLite CLI (Fastest Method)

### Prerequisites
- SQLite installed on your machine
- Access to your database file

### Steps

#### A. Using Command Line (Recommended)

```bash
# Navigate to your database directory
cd G:\new-garage-app\prisma

# Open SQLite with your database
sqlite3 dev.db

# In the SQLite prompt, execute the schema script
.read ../database/schema.sql

# Execute sample data (optional, for testing)
.read ../database/sample_data.sql

# Verify tables were created
.tables
.schema Customer
.schema Vehicle

# Exit SQLite
.quit
```

#### B. Execute Script File Directly

```bash
# From command line (don't open interactive prompt)
sqlite3 G:\new-garage-app\prisma\dev.db < G:\new-garage-app\database\schema.sql

# Then insert sample data
sqlite3 G:\new-garage-app\prisma\dev.db < G:\new-garage-app\database\sample_data.sql
```

#### C. Windows PowerShell Command

```powershell
# Check if sqlite3 is available
where sqlite3

# Execute schema
sqlite3 "G:\new-garage-app\prisma\dev.db" < "G:\new-garage-app\database\schema.sql"

# Execute sample data
sqlite3 "G:\new-garage-app\prisma\dev.db" < "G:\new-garage-app\database\sample_data.sql"

# Verify with a test query
sqlite3 "G:\new-garage-app\prisma\dev.db" "SELECT COUNT(*) FROM Customer;"
```

## Option 2: Node.js Application

### Using Prisma Studio (Built-in)

```bash
# Open Prisma Studio GUI
cd G:\new-garage-app
npx prisma studio

# This opens a visual database editor where you can:
# - View existing tables
# - Add/edit records
# - Test queries
# - Verify foreign keys
```

### Using Node.js Script

Create a file: `scripts/setup-db.js`

```javascript
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('./prisma/dev.db', (err) => {
  if (err) console.error('Error opening database', err);
  else console.log('Connected to SQLite database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;');

// Read and execute schema
const schemaSQL = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
db.exec(schemaSQL, (err) => {
  if (err) console.error('Error executing schema:', err);
  else console.log('✓ Schema created successfully');
  
  // Read and execute sample data
  const sampleSQL = fs.readFileSync(path.join(__dirname, '../database/sample_data.sql'), 'utf8');
  db.exec(sampleSQL, (err) => {
    if (err) console.error('Error inserting sample data:', err);
    else console.log('✓ Sample data inserted successfully');
    
    // Verify
    db.all('SELECT COUNT(*) as count FROM Customer', [], (err, rows) => {
      if (rows) console.log(`✓ Total customers: ${rows[0].count}`);
      db.close();
    });
  });
});
```

Run it:
```bash
node scripts/setup-db.js
```

### Using a Next.js API Route

Create file: `app/api/setup-database/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import fs from "fs"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    // Read SQL files
    const schemaPath = path.join(process.cwd(), "database", "schema.sql")
    const samplePath = path.join(process.cwd(), "database", "sample_data.sql")
    
    const schemaSQL = fs.readFileSync(schemaPath, "utf-8")
    const sampleSQL = fs.readFileSync(samplePath, "utf-8")
    
    // Execute schema
    await prisma.$executeRawUnsafe(schemaSQL)
    
    // Execute sample data
    await prisma.$executeRawUnsafe(sampleSQL)
    
    return NextResponse.json({ 
      message: "Database setup completed successfully",
      status: "success"
    })
  } catch (error) {
    console.error("Database setup error:", error)
    return NextResponse.json(
      { error: "Database setup failed", details: error },
      { status: 500 }
    )
  }
}
```

Call it:
```bash
curl -X POST http://localhost:3000/api/setup-database
```

## Option 3: Python Script

Create file: `scripts/setup_db.py`

```python
import sqlite3
import os

DATABASE_PATH = "./prisma/dev.db"

def setup_database():
    try:
        # Connect to database
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys = ON")
        
        # Read and execute schema
        with open("./database/schema.sql", "r") as f:
            schema_sql = f.read()
        
        cursor.executescript(schema_sql)
        print("✓ Schema created successfully")
        
        # Read and execute sample data
        with open("./database/sample_data.sql", "r") as f:
            sample_sql = f.read()
        
        cursor.executescript(sample_sql)
        print("✓ Sample data inserted successfully")
        
        # Verify
        cursor.execute("SELECT COUNT(*) as count FROM Customer")
        result = cursor.fetchone()
        print(f"✓ Total customers: {result[0]}")
        
        conn.commit()
        conn.close()
        print("✓ Database setup completed")
        
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    setup_database()
```

Run it:
```bash
python scripts/setup_db.py
```

## Option 4: Database GUI Tools

### Using DBeaver (Free)

1. **Download & Install**: https://dbeaver.io
2. **Create Connection**:
   - File → New Database Connection
   - Select SQLite
   - Path: `G:\new-garage-app\prisma\dev.db`
3. **Execute Script**:
   - Right-click connection → SQL Editor → New SQL Script
   - Open `schema.sql`
   - Execute (Ctrl+Enter)
   - Repeat for `sample_data.sql`
4. **Verify**: Right-click connection → Refresh → Expand tables

### Using VS Code SQLite Extension

1. **Install Extension**: "SQLite" by alexcvzz
2. **Open Database**: Ctrl+Shift+P → "SQLite: Open Database"
3. **Select**: `G:\new-garage-app\prisma\dev.db`
4. **Execute Script**:
   - Right-click file → "SQLite: Execute"
   - Or use "SQLite: Run Query"

## Verification Checklist

After running the scripts, verify everything is set up correctly:

### Check Tables Exist
```sql
-- In sqlite3 CLI
.tables
```
Should show: `Customer Vehicle` (and other existing tables)

### Check Customer Table Structure
```sql
PRAGMA table_info(Customer);
```
Expected output includes: CustomerID, CustomerName, Address, MobileNo, StateID, GSTIN, PAN, DateCreated

### Check Vehicle Table Structure
```sql
PRAGMA table_info(Vehicle);
```
Expected output includes: VehicleID, CustomerID, RegistrationNumber, VehicleMake, VehicleModel, DateCreated

### Check Foreign Key Relationship
```sql
PRAGMA foreign_key_list(Vehicle);
```
Should show: Foreign Key from Vehicle(CustomerID) → Customer(CustomerID)

### Verify Indexes
```sql
SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name IN ('Customer', 'Vehicle');
```
Should show indexes for MobileNo, CustomerID, etc.

### Check Sample Data (if inserted)
```sql
SELECT COUNT(*) as CustomerCount FROM Customer;
SELECT COUNT(*) as VehicleCount FROM Vehicle;
```
Should return: 8 customers, 15 vehicles (with sample data)

## Troubleshooting

### Issue 1: "Cannot read schema.sql" or File Not Found

**Solution**:
```powershell
# Verify file exists
Test-Path "G:\new-garage-app\database\schema.sql"

# Check correct path
cd G:\new-garage-app
ls database/
```

### Issue 2: "Cannot find sqlite3 command"

**Solution**: Install SQLite
```powershell
# Using Chocolatey (if installed)
choco install sqlite

# Or download from: https://www.sqlite.org/download.html
```

### Issue 3: "Database is locked"

**Solution**: Close other connections
```powershell
# Close PrismaStudio or other DB connections
# Then retry
```

### Issue 4: "Foreign key constraint failed"

**Solution**: Ensure foreign keys are enabled
```sql
-- Check if enabled (1 = enabled)
PRAGMA foreign_keys;

-- Enable them
PRAGMA foreign_keys = ON;
```

### Issue 5: "Duplicate entry for unique constraint"

**Solution**: Clean database first
```sql
-- In schema.sql, we already DROP TABLE IF EXISTS
-- But if you're running twice, it will fail on sample_data.sql
-- Solution: Run schema.sql again to drop and recreate tables
```

### Issue 6: "Table already exists"

**Solution**: The schema.sql file already includes DROP IF EXISTS
```sql
-- If you get this error, you may have modified the schema.sql
-- Ensure it includes:
DROP TABLE IF EXISTS Vehicle;
DROP TABLE IF EXISTS Customer;
```

## Recommended Setup Workflow

### First Time Setup

```bash
# 1. Navigate to project
cd G:\new-garage-app

# 2. Ensure database directory exists
mkdir database -Force

# 3. Execute schema (creates tables)
sqlite3 prisma/dev.db < database/schema.sql

# 4. Insert sample data (optional but recommended for testing)
sqlite3 prisma/dev.db < database/sample_data.sql

# 5. Verify setup
sqlite3 prisma/dev.db "SELECT COUNT(*) as Customers FROM Customer; SELECT COUNT(*) as Vehicles FROM Vehicle;"

# 6. Start your app
npm run dev

# 7. (Optional) Open database viewer
npx prisma studio
```

### Production Deployment

```bash
# 1. Create fresh database without sample data
sqlite3 path/to/production.db < database/schema.sql

# 2. DO NOT run sample_data.sql in production

# 3. Create database backups
# Setup automated backup script before going live
```

## Important Notes

1. **File Paths**: Adjust paths based on your OS
   - Windows: Use backslashes or double-forward slashes
   - Linux/Mac: Use forward slashes

2. **Pragma Settings**: The schema includes:
   - `PRAGMA foreign_keys = ON` - Enables foreign key constraints
   - Essential for data integrity

3. **Unique Constraints**: 
   - MobileNo: Only one customer per number
   - RegistrationNumber: Only one vehicle per plate

4. **Indexes**: Created for performance
   - idx_Customer_MobileNo: For search functionality
   - idx_Vehicle_CustomerID: For cascading dropdowns

5. **Timestamps**: All DateCreated fields default to CURRENT_TIMESTAMP

## Next Steps

After successful setup:

1. ✅ Verify tables exist in database
2. ✅ Test sample data queries (from schema.sql)
3. ✅ Update your application to use new tables
4. ✅ Test cascading dropdown queries
5. ✅ Implement auto-populate functionality
6. ✅ Deploy to production (without sample data)

## Quick Reference Commands

```bash
# Execute schema from anywhere
sqlite3 "<DB_PATH>" < "<SCHEMA_PATH>"

# Execute with output to file
sqlite3 "<DB_PATH>" < "<SCHEMA_PATH>" > setup.log

# Interactive SQL shell
sqlite3 "<DB_PATH>"

# Run single query
sqlite3 "<DB_PATH>" "SELECT * FROM Customer LIMIT 1;"

# Check database integrity
sqlite3 "<DB_PATH>" "PRAGMA integrity_check;"

# Backup database
sqlite3 "<DB_PATH>" ".backup '<BACKUP_PATH>'"

# Restore database
sqlite3 "<DB_PATH>" ".restore '<BACKUP_PATH>'"
```

---

**Questions?** Review the SQL files for complete documentation of all fields, constraints, and sample queries.

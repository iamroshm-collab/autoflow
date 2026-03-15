#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();

// Usage:
//   node scripts/import-vehicles.js /path/to/VehicleDetails.csv /path/to/dev.db
// Defaults: ./VehicleDetails.csv and ./prisma/dev.db

const csvPath = process.argv[2] || path.resolve(process.cwd(), 'VehicleDetails.csv');
const dbPath = process.argv[3] || path.resolve(process.cwd(), 'prisma', 'dev.db');

if (!fs.existsSync(csvPath)) {
  console.error('CSV file not found:', csvPath);
  process.exit(1);
}

console.log('Using CSV:', csvPath);
console.log('Using DB:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

let count = 0;

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run('BEGIN TRANSACTION');

  // Create a minimal vehicle table if it doesn't exist. Remove or adapt if your schema differs.
  db.run(
    `CREATE TABLE IF NOT EXISTS vehicle (
      id TEXT PRIMARY KEY,
      customerid TEXT,
      registrationNumber TEXT,
      make TEXT,
      model TEXT,
      createdAt TEXT
    )`
  );

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO vehicle (id, customerid, registrationNumber, make, model, createdAt) VALUES (?, ?, ?, ?, ?, ?)`
  );

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
      const id = row.VehicleID ?? row.VehicleId ?? row.vehicleid ?? row.id;
      const customerid = row.CustomerID ?? row.CustomerId ?? row.customerid ?? row.customer;
      const registrationNumber = row.RegistrationNumber ?? row.Registration_No ?? row.reg_no ?? row.registratioNNumber ?? row.registrationNumber;
      const make = row.VehicleMake ?? row.Make ?? row.make;
      const model = row.VehicleModel ?? row.Model ?? row.model;
      const dateRaw = row.DateCreated ?? row.CreatedAt ?? row.createdAt ?? row.Date;

      let createdAt = null;
      if (dateRaw) {
        const parsed = Date.parse(dateRaw);
        createdAt = isNaN(parsed) ? null : new Date(parsed).toISOString();
      }

      try {
        stmt.run(id, customerid, registrationNumber, make, model, createdAt);
        count += 1;
      } catch (e) {
        console.error('Failed to insert row:', e.message, row);
      }
    })
    .on('end', () => {
      stmt.finalize((err) => {
        if (err) console.error('Finalize error:', err.message);
        db.run('COMMIT', (err2) => {
          if (err2) console.error('Commit error:', err2.message);
          console.log(`Imported ${count} rows into ${dbPath}`);
          db.close();
        });
      });
    })
    .on('error', (err) => {
      console.error('CSV read error:', err.message);
      db.run('ROLLBACK', () => db.close());
      process.exit(1);
    });
});

process.on('SIGINT', () => {
  console.log('\nInterrupted. Closing DB.');
  db.close();
  process.exit(1);
});

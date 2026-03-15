#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();

// Usage:
//   node scripts/import-customers.js /path/to/Customer.csv /path/to/dev.db
// Defaults: ./Customer.csv and ./prisma/dev.db

const csvPath = process.argv[2] || path.resolve(process.cwd(), 'Customer.csv');
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

  // Ensure a Customer table exists. If your project already has a different schema,
  // you can remove or adapt this block.
  db.run(
    `CREATE TABLE IF NOT EXISTS Customer (
      id TEXT PRIMARY KEY,
      name TEXT,
      mobileno TEXT,
      state TEXT,
      gstin TEXT,
      pan TEXT,
      createdAt TEXT
    )`
  );

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO Customer (id, name, mobileno, state, gstin, pan, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
      // tolerant header handling: try common header variants
      const id = row.CustID ?? row.CustId ?? row.custid ?? row.id;
      const name = row.CustomerName ?? row.Customer ?? row.customerName ?? row.name;
      const mobileno = row.MobileNo ?? row.Mobile ?? row.mobile ?? row.mobileno;
      const state = row.StateID ?? row.State ?? row.state ?? row.StateId;
      const gstin = row.GSTIN ?? row.Gstin ?? row.gstin;
      const pan = row.PAN ?? row.Pan ?? row.pan;
      const dateRaw = row.DateCreated ?? row.CreatedAt ?? row.createdAt ?? row.Date;

      let createdAt = null;
      if (dateRaw) {
        const parsed = Date.parse(dateRaw);
        createdAt = isNaN(parsed) ? null : new Date(parsed).toISOString();
      }

      try {
        stmt.run(id, name, mobileno, state, gstin, pan, createdAt);
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

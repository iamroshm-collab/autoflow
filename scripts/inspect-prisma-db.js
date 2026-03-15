const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('Failed to open DB:', err.message);
});

function run() {
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
    if (err) return console.error('List tables error:', err.message);
    console.log('Tables:');
    rows.forEach(r => console.log('-', r.name));

    const table = 'Customer';
    db.all(`PRAGMA table_info('${table}')`, (err2, cols) => {
      if (err2) return console.error(`PRAGMA error for ${table}:`, err2.message);
      console.log(`\nSchema for ${table}:`);
      if (!cols || cols.length === 0) return console.log(`Table ${table} not found.`);
      cols.forEach(c => console.log(c.cid, c.name, c.type, c.notnull ? 'NOT NULL' : '', c.dflt_value ? `DEFAULT ${c.dflt_value}` : ''));

      db.get(`SELECT COUNT(*) as cnt FROM ${table}`, (err3, cntRow) => {
        if (err3) return console.error(`Count error for ${table}:`, err3.message);
        console.log(`\n${table} row count:`, cntRow.cnt);

        db.all(`SELECT * FROM ${table} LIMIT 10`, (err4, sample) => {
          if (err4) return console.error(`Select error for ${table}:`, err4.message);
          console.log(`\nSample rows from ${table}:`);
          console.log(JSON.stringify(sample, null, 2));
          db.close();
        });
      });
    });
  });
}

run();

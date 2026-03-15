const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('Failed to open DB:', err.message);
});

db.serialize(() => {
  db.all("PRAGMA table_info('vehicle')", (err, cols) => {
    if (err) return console.error('PRAGMA error:', err.message);
    console.log('vehicle schema:');
    console.log(JSON.stringify(cols, null, 2));

    db.get("SELECT COUNT(*) as cnt FROM vehicle", (err2, cntRow) => {
      if (err2) return console.error('Count error:', err2.message);
      console.log('\nvehicle row count:', cntRow.cnt);

      db.all('SELECT * FROM vehicle LIMIT 10', (err3, rows) => {
        if (err3) return console.error('Select error:', err3.message);
        console.log('\nsample rows:');
        console.log(JSON.stringify(rows, null, 2));
        db.close();
      });
    });
  });
});

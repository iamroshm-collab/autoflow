const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
const db = new sqlite3.Database(dbPath, (err) => { if (err) console.error(err); });

db.serialize(() => {
  db.all('SELECT * FROM vehicle LIMIT 10', (err, vehicles) => {
    if (err) return console.error(err);
    vehicles.forEach(v => {
      db.get(`SELECT * FROM Customer WHERE id = ?`, [v.customerid], (e, cust) => {
        console.log('Vehicle:', v.registrationNumber, 'customerid:', v.customerid);
        if (e) return console.error('cust lookup error', e);
        console.log('Matched customer row:', cust);
      });
    });
  });
});

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const skippedPath = path.resolve(process.cwd(), 'skipped-servicedescription.csv');
const servicePath = path.resolve(process.cwd(), 'ServiceEntry.csv');
const outPath = path.resolve(process.cwd(), 'skipped-servicedescription-diff.csv');

if (!fs.existsSync(skippedPath)) { console.error('skipped-servicedescription.csv not found'); process.exit(2); }
if (!fs.existsSync(servicePath)) { console.error('ServiceEntry.csv not found'); process.exit(2); }

// Load ServiceEntry into map by SL (legacy jobcard id)
const serviceMap = new Map();
fs.createReadStream(servicePath)
  .pipe(csv())
  .on('data', (r) => {
    const sl = (r['SL'] || r['Sl'] || r['sl'] || '').toString().trim();
    if (sl) serviceMap.set(sl, r);
  })
  .on('end', () => {
    const rows = [];
    fs.createReadStream(skippedPath)
      .pipe(csv())
      .on('data', (r) => {
        const sid = (r['ServiceID'] || r['ServiceId'] || r['serviceid'] || '').toString().trim();
        const svc = serviceMap.get(sid) || null;
        const out = {
          ServiceDetailsID: r['ServiceDetailsID'] || r['ServiceDetailsId'] || '',
          ServiceID: sid,
          Description: r['Description'] || '',
          ServiceEntryFound: svc ? 'yes' : 'no',
          JobCardNumber: svc ? (svc['JobCardNumber'] || svc['JobCard'] || '') : '',
          CustomerID: svc ? (svc['CustomerID'] || svc['CustomerId'] || '') : '',
          VehicleID: svc ? (svc['VehicleID'] || svc['VehicleId'] || '') : '',
          Reason: svc ? 'unknown' : 'jobcard_missing'
        };
        rows.push(out);
      })
      .on('end', () => {
        const header = ['ServiceDetailsID','ServiceID','Description','ServiceEntryFound','JobCardNumber','CustomerID','VehicleID','Reason'];
        const lines = [header.join(',')];
        for (const r of rows) {
          const vals = header.map(h => `"${((''+(r[h]||'')).replace(/"/g,'""'))}"`);
          lines.push(vals.join(','));
        }
        fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
        console.log('WROTE', outPath, 'rows=', rows.length);
      });
  });

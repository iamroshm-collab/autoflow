const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const missingPath = path.resolve(process.cwd(), 'missing-jobcards.csv');
const svcPath = path.resolve(process.cwd(), 'ServiceDetails.csv');
const outPath = path.resolve(process.cwd(), 'skipped-servicedescription.csv');

if (!fs.existsSync(svcPath)) {
  console.error('ServiceDetails.csv not found at', svcPath);
  process.exit(2);
}

const miss = new Set();
if (fs.existsSync(missingPath)) {
  const lines = fs.readFileSync(missingPath, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  lines.forEach(l => miss.add(l.trim()));
} else {
  console.error('missing-jobcards.csv not found, no filter applied');
  process.exit(2);
}

const rows = [];
fs.createReadStream(svcPath)
  .pipe(csv())
  .on('data', (r) => {
    try {
      const id = (r['ServiceID'] || r['ServiceId'] || r['serviceid'] || '').toString().trim();
      if (miss.has(id)) rows.push(r);
    } catch (e) { /* ignore row parse errors */ }
  })
  .on('end', () => {
    if (rows.length === 0) {
      console.log('No matching skipped rows found');
      process.exit(0);
    }
    const header = Object.keys(rows[0]);
    const out = [header.join(',')];
    for (const r of rows) {
      const vals = header.map(h => ('' + (r[h] || '')).replace(/"/g, '""'));
      out.push(vals.map(v => `"${v}"`).join(','));
    }
    fs.writeFileSync(outPath, out.join('\n'), 'utf8');
    console.log('WROTE', outPath, 'rows=', rows.length);
  });

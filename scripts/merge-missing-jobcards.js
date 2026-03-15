const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'reports', 'migration-missing');
if (!fs.existsSync(dir)) {
  console.error('Reports folder not found:', dir);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter(f => f.toLowerCase().includes('jobcard') && f.endsWith('.csv'));
const ids = new Set();
for (const f of files) {
  const p = path.join(dir, f);
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  // skip header
  for (let i=1;i<lines.length;i++) ids.add(lines[i]);
}

const out = path.join(process.cwd(), 'missing-jobcards.csv');
fs.writeFileSync(out, 'legacyId\n' + Array.from(ids).sort((a,b)=>Number(a)-Number(b)).join('\n'));
console.log('Wrote', out, ids.size, 'unique legacyIds');

process.exit(0);

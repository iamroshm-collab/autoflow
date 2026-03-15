const fs = require('fs');
const path = require('path');

const appdata = process.env.APPDATA;
if (!appdata) {
  console.error('APPDATA not set; cannot locate VS Code workspaceStorage');
  process.exit(1);
}

const storage = path.join(appdata, 'Code', 'User', 'workspaceStorage');

function walk(dir, files=[]) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

const allFiles = walk(storage).filter(f => f.endsWith('content.txt'));
if (allFiles.length === 0) {
  console.error('No log content files found under', storage);
  process.exit(1);
}

const skippedBy = {}; // { table: { reason: Set(ids) } }
const insertErrors = [];
const summaries = {}; // table-> { inserted, skipped }

const skipRe = /(\w+)\s+skipped\s+\(([^)]+)\)\s+legacy:\s*(\d+)/i;
const insertErrRe = /(\w+)\s+insert error for legacyId\s*(\d+)\s*(.+)/i;
const summaryRe = /(\w+):\s+inserted=(\d+)\s+skipped=(\d+)/i;

for (const file of allFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    let m = skipRe.exec(line);
    if (m) {
      const tableRaw = m[1];
      const reason = m[2];
      const id = m[3];
      const table = mapTableName(tableRaw);
      skippedBy[table] = skippedBy[table] || {};
      skippedBy[table][reason] = skippedBy[table][reason] || new Set();
      skippedBy[table][reason].add(id);
      continue;
    }
    m = insertErrRe.exec(line);
    if (m) {
      insertErrors.push({ table: mapTableName(m[1]), legacyId: m[2], error: m[3].trim() });
      continue;
    }
    m = summaryRe.exec(line);
    if (m) {
      const table = mapTableName(m[1]);
      summaries[table] = { inserted: Number(m[2]), skipped: Number(m[3]) };
      continue;
    }
  }
}

function mapTableName(raw) {
  const r = raw.toLowerCase();
  if (r === 'spare') return 'sparepartsbill';
  if (r === 'servicedescription') return 'servicedescription';
  if (r === 'employeeearning' || r === 'employeeearning') return 'employeeEarning';
  if (r === 'employeeearning') return 'employeeEarning';
  return r;
}

const outDir = path.join(process.cwd(), 'reports', 'migration-missing');
fs.mkdirSync(outDir, { recursive: true });

for (const [table, reasons] of Object.entries(skippedBy)) {
  for (const [reason, set] of Object.entries(reasons)) {
    const ids = Array.from(set).sort((a,b)=>Number(a)-Number(b));
    const file = path.join(outDir, `${table}--${reason.replace(/[^a-z0-9]+/gi,'_')}.csv`);
    fs.writeFileSync(file, 'legacyId\n' + ids.join('\n'));
    console.log('Wrote', file, ids.length, 'unique ids');
  }
}

if (insertErrors.length) {
  const file = path.join(outDir, 'insert-errors.csv');
  fs.writeFileSync(file, 'table,legacyId,error\n' + insertErrors.map(e=>`${e.table},${e.legacyId},"${e.error.replace(/"/g,'""')}"`).join('\n'));
  console.log('Wrote', file, insertErrors.length, 'insert errors');
}

const summaryFile = path.join(outDir, 'migration-summary.txt');
let sumText = '';
for (const [t,s] of Object.entries(summaries)) {
  sumText += `${t}: inserted=${s.inserted} skipped=${s.skipped}\n`;
}
fs.writeFileSync(summaryFile, sumText);
console.log('Wrote summary to', summaryFile);

console.log('Done. Reports are in', outDir);

process.exit(0);

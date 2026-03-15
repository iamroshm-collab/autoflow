const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const logPath = path.resolve(process.cwd(), 'c:/Users/Thakkudu/AppData/Roaming/Code/User/workspaceStorage/9e31097eb67e112e8e0d25eaab4fe91c/GitHub.copilot-chat/chat-session-resources/217f2b9e-3acb-46c5-a3c2-d2ba006b4302/call_tFEJn5uTlYQUb8nR2xHsKs7T__vscode-1771936916085/content.txt');
const skippedCsv = path.resolve(process.cwd(), 'skipped-servicedescription.csv');
const outPath = path.resolve(process.cwd(), 'missing-jobcards-report.txt');

if (!fs.existsSync(logPath)) { console.error('Log file not found:', logPath); process.exit(2); }
if (!fs.existsSync(skippedCsv)) { console.error('Skipped CSV not found:', skippedCsv); process.exit(2); }

const log = fs.readFileSync(logPath, 'utf8');
const re = /ServiceDescription skipped \(jobcard missing\) legacy: (\d+)/g;
const counts = new Map();
let m;
while ((m = re.exec(log)) !== null) {
  const id = m[1];
  counts.set(id, (counts.get(id) || 0) + 1);
}

const top = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);

// collect sample rows from skipped-servicedescription.csv (which contains rows for missing IDs)
const samples = {};
fs.createReadStream(skippedCsv)
  .pipe(csv())
  .on('data', (row) => {
    const sid = (row['ServiceID'] || '').toString().trim();
    if (!samples[sid]) samples[sid] = [];
    if (samples[sid].length < 3) samples[sid].push(row);
  })
  .on('end', () => {
    const lines = [];
    lines.push('Missing jobcard report');
    lines.push('Generated: ' + new Date().toISOString());
    lines.push('');
    lines.push('Top missing jobcard legacy IDs (top 10 by occurrences in migration log):');
    lines.push('ID,Count');
    for (const [id,count] of top) {
      lines.push(`${id},${count}`);
    }
    lines.push('');
    lines.push('Samples (up to 3 skipped ServiceDetails rows per ID):');
    for (const [id] of top) {
      lines.push('');
      lines.push('---');
      lines.push('Jobcard legacyId: ' + id);
      const s = samples[id] || [];
      if (s.length === 0) {
        lines.push('(no sample rows found in skipped-servicedescription.csv)');
        continue;
      }
      const header = Object.keys(s[0]);
      lines.push(header.join(','));
      for (const r of s) {
        const vals = header.map(h => (`"${(''+(r[h]||'')).replace(/"/g,'""')}"`));
        lines.push(vals.join(','));
      }
    }

    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log('WROTE', outPath);
  });

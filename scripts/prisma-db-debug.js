require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

(async function main(){
  let prisma;
  try {
    const raw = process.env.DATABASE_URL || '';
    console.log('DATABASE_URL:', raw || '(not set)');

    let fileSpec = '';
    const m = raw.match(/^(?:file|sqlite):(?:\/\/\/|\/\/)?(.*)$/);
    if (m) fileSpec = m[1]; else fileSpec = raw;

    if (!fileSpec) {
      console.log('Could not parse a file path from DATABASE_URL');
    }

    const absPath = fileSpec ? (path.isAbsolute(fileSpec) ? path.normalize(fileSpec) : path.resolve(process.cwd(), fileSpec)) : '';
    console.log('Resolved SQLite file path:', absPath || '(none)');

    if (absPath) {
      try {
        const st = fs.statSync(absPath);
        console.log('Exists: true');
        console.log('Size:', st.size, 'bytes');
      } catch (err) {
        console.log('Exists: false');
      }
    }

    prisma = new PrismaClient({ log: [] });

    const models = [
      'customer',
      'vehicle',
      'jobcard',
      'servicedescription',
      'sparepartsbill',
      'employeeEarning'
    ];

    for (const name of models) {
      try {
        const model = prisma[name];
        if (!model || typeof model.count !== 'function') {
          console.log(`${name}: model not available on Prisma Client`);
          continue;
        }
        const count = await model.count();
        console.log(`${name}: ${count}`);
      } catch (e) {
        console.log(`${name}: error - ${e && e.message ? e.message : e}`);
      }
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err && err.message ? err.message : err);
    if (prisma) await prisma.$disconnect();
    process.exit(1);
  }
})();

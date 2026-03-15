#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const missingPath = path.resolve(process.cwd(), 'missing-jobcards.csv');
if (!fs.existsSync(missingPath)) {
  console.error('missing-jobcards.csv not found in workspace root');
  process.exit(2);
}

const ids = fs.readFileSync(missingPath, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
console.log('Will create placeholders for', ids.length, 'IDs');

async function ensurePlaceholder(id) {
  const mobileNo = `placeholder-${id}@example.invalid`;
  const reg = `PLACEHOLDER-VEH-${id}`;
  const jc = `PLACEHOLDER-JC-${id}`;

  const customer = await prisma.customer.upsert({
    where: { mobileNo },
    update: {},
    create: { mobileNo, name: `Placeholder Customer ${id}` },
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { registrationNumber: reg },
    update: {},
    create: {
      registrationNumber: reg,
      make: 'Placeholder',
      model: 'Placeholder',
      customerId: customer.id,
    },
  });

  const jobcard = await prisma.jobCard.upsert({
    where: { jobCardNumber: jc },
    update: {},
    create: {
      jobCardNumber: jc,
      serviceDate: new Date(),
      customerId: customer.id,
      vehicleId: vehicle.id,
    },
  });

  return { id, customerId: customer.id, vehicleId: vehicle.id, jobCardId: jobcard.id };
}

(async () => {
  try {
    const results = [];
    for (const id of ids) {
      try {
        const res = await ensurePlaceholder(id);
        results.push(res);
        console.log('OK', id);
      } catch (e) {
        console.error('ERR', id, e.message || e);
      }
    }
    console.log('Done. Created/verified', results.length, 'placeholders');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();

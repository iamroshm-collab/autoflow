const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const missingPath = path.resolve(process.cwd(), 'missing-jobcards.csv');
const servicePath = path.resolve(process.cwd(), 'ServiceEntry.csv');
const customerPath = path.resolve(process.cwd(), 'Customer.csv');
const vehiclePath = path.resolve(process.cwd(), 'VehicleDetails.csv');
const outPath = path.resolve(process.cwd(), 'missing-jobcards-triage.csv');

if (!fs.existsSync(missingPath)) { console.error('missing-jobcards.csv not found'); process.exit(2); }
if (!fs.existsSync(servicePath)) { console.error('ServiceEntry.csv not found'); process.exit(2); }

const missing = fs.readFileSync(missingPath,'utf8').split(/\r?\n/).slice(1).filter(Boolean);

// load ServiceEntry into map by SL
const serviceMap = new Map();
const customersSet = new Set();
const vehiclesSet = new Set();

function loadCsvToMap(filePath, keyCols) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (r) => rows.push(r))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

(async () => {
  const [services, customers, vehicles] = await Promise.all([
    loadCsvToMap(servicePath),
    fs.existsSync(customerPath) ? loadCsvToMap(customerPath) : Promise.resolve([]),
    fs.existsSync(vehiclePath) ? loadCsvToMap(vehiclePath) : Promise.resolve([]),
  ]);

  for (const c of customers) {
    const id = (c['CustID'] || c['CustId'] || c['custid'] || '').toString().trim();
    if (id) customersSet.add(id);
  }
  for (const v of vehicles) {
    const id = (v['VehicleID'] || '').toString().trim();
    if (id) vehiclesSet.add(id);
  }

  for (const s of services) {
    const sl = (s['SL'] || '').toString().trim();
    if (sl) serviceMap.set(sl, s);
  }

  const out = ['legacyId,foundInServiceEntry,customerLegacy,customerExists,vehicleLegacy,vehicleExists,recommendedAction'];

  for (const m of missing) {
    const row = {};
    row.legacyId = m;
    const service = serviceMap.get(m);
    if (!service) {
      // servicedescription references jobcard not present in ServiceEntry -> fix CSVs
      out.push(`${m},no,,, , ,fix-servicedescription-or-add-jobcard`);
      continue;
    }
    const custLegacy = (service['CustomerID'] || service['CustomerId'] || service['Customer'] || '').toString().trim();
    const vehLegacy = (service['VehicleID'] || service['VehicleId'] || service['Vehicle'] || '').toString().trim();
    const custExists = custLegacy ? customersSet.has(custLegacy) : false;
    const vehExists = vehLegacy ? vehiclesSet.has(vehLegacy) : false;

    // Decide action:
    // - if both customer and vehicle exist: recommend re-run jobcard import (maybe earlier failed) => create-jobcard
    // - if one or both parents missing: recommend fix source CSVs (add missing parents) or create placeholders
    let action = 'review';
    if (custExists && vehExists) action = 'create-jobcard';
    else if (!custExists && !vehExists) action = 'create-customer-and-vehicle-or-fix-csv';
    else if (!custExists) action = 'create-customer-or-fix-csv';
    else if (!vehExists) action = 'create-vehicle-or-fix-csv';

    out.push(`${m},yes,${custLegacy || ''},${custExists},${vehLegacy || ''},${vehExists},${action}`);
  }

  fs.writeFileSync(outPath, out.join('\n'), 'utf8');
  console.log('WROTE', outPath);
})();

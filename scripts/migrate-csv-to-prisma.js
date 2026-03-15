#!/usr/bin/env node
/**
 * CSV -> Prisma migration script
 * - Uses dotenv to read DATABASE_URL
 * - Uses Prisma Client
 * - Uses csv-parser
 * - Single transaction per table
 * - Preserves legacy numeric IDs in `legacyId` and lets Prisma generate `id` (cuid)
 * - Looks up parent records using legacyId, skips & logs rows when parent missing
 * - Converts dates and numbers safely
 *
 * Usage: node scripts/migrate-csv-to-prisma.js
 * Ensure `.env` contains DATABASE_URL and `npm install csv-parser dotenv @prisma/client` ran.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CSV_DIR = process.cwd(); // assume CSVs are in repo root
const CHUNK_SIZE = 200; // number of rows to process per transaction to avoid timeouts

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

async function importCustomers(createIfMissing = true) {
  const file = path.join(CSV_DIR, 'Customer.csv');
  if (!fs.existsSync(file)) {
    console.log('Customer.csv not found, skipping customers');
    return new Map();
  }
  const rows = await parseCsv(file);
  const legacyToId = new Map();
  let inserted = 0, skipped = 0;

  const chunks = chunkArray(rows, CHUNK_SIZE);
  for (const chunk of chunks) {
      for (const chunk of chunks) {
        await prisma.$transaction(async (tx) => {
          for (const row of chunk) {
            const legacyId = toNumber(row['CustID'] || row['CustId'] || row['custid']);
            if (!legacyId) {
              skipped++; console.warn('Customer skipped (no legacyId):', row); continue;
            }
            const data = {
              // keep field names matching Prisma schema where possible
              // note: some fields may differ per schema; adjust if necessary
              legacyId,
              name: row['CustomerName'] || null,
              mobileNo: row['MobileNo'] || null,
              state: row['StateID'] ? String(toNumber(row['StateID'])) : null,
              gstin: row['GSTIN'] || null,
              pan: row['PAN'] || null,
              createdAt: toDate(row['DateCreated']) || undefined,
            };
            try {
              let rec;
              if (data.mobileNo) {
                if (createIfMissing) {
                  rec = await tx.customer.upsert({
                    where: { mobileNo: data.mobileNo },
                    update: data,
                    create: data,
                  });
                } else {
                  rec = await tx.customer.findUnique({ where: { mobileNo: data.mobileNo } });
                  if (!rec) { skipped++; console.warn('Customer not found (no create):', data.mobileNo); continue; }
                }
              } else {
                if (!createIfMissing) { skipped++; console.warn('Customer skipped (no mobileNo and create disabled):', row); continue; }
                rec = await tx.customer.create({ data });
              }
              legacyToId.set(legacyId, rec.id);
              inserted++;
            } catch (err) {
              skipped++; console.error('Customer insert/upsert error for legacyId', legacyId, err.message || err);
            }
          }
        });
      }
  }

  console.log(`customer: inserted=${inserted} skipped=${skipped}`);
  return legacyToId;
}

async function importEmployees() {
  const file = path.join(CSV_DIR, 'Employee.csv');
  async function importEmployees(createIfMissing = true) {
    console.log('Employee.csv not found, skipping employees');
    return new Map();
  }
  const rows = await parseCsv(file);
  const legacyToId = new Map();
  let inserted = 0, skipped = 0;

  const empChunks = chunkArray(rows, CHUNK_SIZE);
  for (const chunk of empChunks) {
    const rows = await parseCsv(file);
    const legacyToId = new Map();
    let inserted = 0, skipped = 0;

    const empChunks = chunkArray(rows, CHUNK_SIZE);
    for (const chunk of empChunks) {
      await prisma.$transaction(async (tx) => {
        for (const row of chunk) {
          const legacyId = toNumber(row['EmployeeID']);
          if (!legacyId) { skipped++; console.warn('Employee skipped (no legacyId):', row); continue; }
          const data = {
            legacyId,
            name: row['EmpName'] || null,
            employeeNumber: row['IDNumber'] || null,
            mobile: row['Mobile'] || null,
            address: row['Address'] || null,
            designation: row['Designation'] || null,
            salaryPerday: toNumber(row['SalaryPerday']),
            startDate: toDate(row['StartDate']) || undefined,
            endDate: toDate(row['EndDate']) || undefined,
          };
          try {
            let rec;
            if (data.employeeNumber) {
              if (createIfMissing) {
                rec = await tx.employee.upsert({ where: { employeeNumber: data.employeeNumber }, update: data, create: data });
              } else {
                rec = await tx.employee.findUnique({ where: { employeeNumber: data.employeeNumber } });
                if (!rec) { skipped++; console.warn('Employee not found (no create):', data.employeeNumber); continue; }
              }
            } else {
              if (!createIfMissing) { skipped++; console.warn('Employee skipped (no employeeNumber and create disabled):', row); continue; }
              rec = await tx.employee.create({ data });
            }
            legacyToId.set(legacyId, rec.id);
            inserted++;
          } catch (err) {
            skipped++; console.error('Employee insert/upsert error for legacyId', legacyId, err.message || err);
          }
        }
      });
    }

    console.log(`employee: inserted=${inserted} skipped=${skipped}`);
    return legacyToId;
  }

  console.log(`employee: inserted=${inserted} skipped=${skipped}`);
  return legacyToId;
}

async function importVehicles(customerMap, createIfMissing = true) {
  const file = path.join(CSV_DIR, 'VehicleDetails.csv');
  if (!fs.existsSync(file)) {
    console.log('VehicleDetails.csv not found, skipping vehicles');
    return new Map();
  }
  const rows = await parseCsv(file);
  const legacyToId = new Map();
  let inserted = 0, skipped = 0;

  const vehChunks = chunkArray(rows, CHUNK_SIZE);
  for (const chunk of vehChunks) {
    await prisma.$transaction(async (tx) => {
      for (const row of chunk) {
        const legacyId = toNumber(row['VehicleID']);
        if (!legacyId) { skipped++; console.warn('Vehicle skipped (no legacyId):', row); continue; }
        const custLegacy = toNumber(row['CustomerID']);
        let customerId = null;
        if (custLegacy) {
          customerId = customerMap.get(custLegacy) || null;
        }
        if (custLegacy && !customerId) {
          // try to find customer in DB by mobile or name?
          // if not found and createIfMissing is false, skip
          if (!createIfMissing) { skipped++; console.warn('Vehicle skipped (customer missing) legacyCustomer:', custLegacy); continue; }
        }
        const data = {
          legacyId,
          registrationNumber: row['RegistrationNumber'] || null,
          make: row['VehicleMake'] || null,
          model: row['VehicleModel'] || null,
          createdAt: toDate(row['DateCreated']) || undefined,
          customerId: customerId || undefined,
        };
        try {
          let rec;
          if (data.registrationNumber) {
            if (createIfMissing) {
              rec = await tx.vehicle.upsert({ where: { registrationNumber: data.registrationNumber }, update: data, create: data });
            } else {
              rec = await tx.vehicle.findUnique({ where: { registrationNumber: data.registrationNumber } });
              if (!rec) { skipped++; console.warn('Vehicle not found (no create):', data.registrationNumber); continue; }
            }
          } else {
            if (!createIfMissing) { skipped++; console.warn('Vehicle skipped (no registrationNumber and create disabled):', row); continue; }
            rec = await tx.vehicle.create({ data });
          }
          legacyToId.set(legacyId, rec.id);
          inserted++;
        } catch (err) {
          skipped++; console.error('Vehicle insert/upsert error for legacyId', legacyId, err.message || err);
        }
      }
    });
  }

  console.log(`vehicle: inserted=${inserted} skipped=${skipped}`);
  return legacyToId;
}

async function importJobcards(customerMap, vehicleMap) {
  const file = path.join(CSV_DIR, 'ServiceEntry.csv');
  if (!fs.existsSync(file)) {
    console.log('ServiceEntry.csv not found, skipping jobcards');
    return new Map();
  }
  const rows = await parseCsv(file);
  const legacyToId = new Map();
  let inserted = 0, skipped = 0;

  const jobChunks = chunkArray(rows, CHUNK_SIZE);
  for (const chunk of jobChunks) {
    await prisma.$transaction(async (tx) => {
      for (const row of chunk) {
        const legacyId = toNumber(row['SL']);
        if (!legacyId) { skipped++; console.warn('Jobcard skipped (no legacyId):', row); continue; }
        const vehicleLegacy = toNumber(row['VehicleID']);
        const customerLegacy = toNumber(row['CustomerID']);

        const vehicleId = vehicleLegacy ? vehicleMap.get(vehicleLegacy) : null;
        const customerId = customerLegacy ? customerMap.get(customerLegacy) : null;

        // fallback: if parent not in in-memory map, try to find by legacyId in DB
        let finalVehicleId = vehicleId;
        let finalCustomerId = customerId;
        if (vehicleLegacy && !finalVehicleId) {
          try {
            const found = await tx.vehicle.findFirst({ where: { legacyId: vehicleLegacy } });
            if (found) { finalVehicleId = found.id; vehicleMap.set(vehicleLegacy, found.id); }
          } catch (e) {
            // ignore DB lookup errors, will skip below
          }
        }
        if (customerLegacy && !finalCustomerId) {
          try {
            const found = await tx.customer.findFirst({ where: { legacyId: customerLegacy } });
            if (found) { finalCustomerId = found.id; customerMap.set(customerLegacy, found.id); }
          } catch (e) {
          }
        }

        if (vehicleLegacy && !finalVehicleId) { skipped++; console.warn('Jobcard skipped (vehicle missing) legacyVehicle:', vehicleLegacy); continue; }
        if (customerLegacy && !finalCustomerId) { skipped++; console.warn('Jobcard skipped (customer missing) legacyCustomer:', customerLegacy); continue; }

        const data = {
          legacyId,
          vehicleId: vehicleId || undefined,
          customerId: customerId || undefined,
          JobCardNumber: row['JobCardNumber'] || null,
          ServiceDate: toDate(row['ServiceDate']) || undefined,
          FileNo: row['FileNo'] || null,
          DeliveryDate: toDate(row['DeliveryDate']) || undefined,
          KMDriven: toNumber(row['KMDriven']),
          NextServiceKM: toNumber(row['NextServiceKM']),
          NextServiceDate: toDate(row['NextServiceDate']) || undefined,
          Total: toNumber(row['Total']),
          PaidAmount: toNumber(row['PaidAmount']),
          PaidDate: toDate(row['PaidDate']) || undefined,
          VehicleStatus: row['VehicleStatus'] || null,
          JobcardStatus: row['JobcardStatus'] || null,
          JobcardPaymentStatus: row['JobcardPaymentStatus'] || null,
          Eletrical: row['Eletrical'] || null,
          ac: row['A/C'] || row['A C'] || null,
          Mechanical: row['Mechanical'] || null,
          Others: row['Others'] || null,
          Balance: toNumber(row['Balance']),
        };
        try {
          // attach resolved parent ids
          if (finalVehicleId) data.vehicleId = finalVehicleId;
          if (finalCustomerId) data.customerId = finalCustomerId;
          const rec = await tx.jobcard.create({ data });
          legacyToId.set(legacyId, rec.id);
          inserted++;
        } catch (err) {
          skipped++; console.error('Jobcard insert error for legacyId', legacyId, err.message || err);
        }
      }
    });
  }

  console.log(`jobcard: inserted=${inserted} skipped=${skipped}`);
  return legacyToId;
}

async function importServiceDescriptions(jobcardMap) {
  const file = path.join(CSV_DIR, 'ServiceDetails.csv');
  if (!fs.existsSync(file)) {
    console.log('ServiceDetails.csv not found, skipping servicedescription');
    return new Map();
  }
  const rows = await parseCsv(file);
  const legacyToId = new Map();
  let inserted = 0, skipped = 0;

  const svcChunks = chunkArray(rows, CHUNK_SIZE);
  for (const chunk of svcChunks) {
    await prisma.$transaction(async (tx) => {
      for (const row of chunk) {
        const legacyId = toNumber(row['ServiceDetailsID']);
        if (!legacyId) { skipped++; console.warn('ServiceDescription skipped (no legacyId):', row); continue; }
        const serviceLegacy = toNumber(row['ServiceID']);
        let jobcardId = serviceLegacy ? jobcardMap.get(serviceLegacy) : null;
        if (serviceLegacy && !jobcardId) {
          try {
            const found = await tx.jobcard.findFirst({ where: { legacyId: serviceLegacy } });
            if (found) { jobcardId = found.id; jobcardMap.set(serviceLegacy, found.id); }
          } catch (e) {
            // ignore and skip
          }
        }
        if (serviceLegacy && !jobcardId) { skipped++; console.warn('ServiceDescription skipped (jobcard missing) legacy:', serviceLegacy); continue; }

        const data = {
          legacyId,
          jobcardId: jobcardId || undefined,
          Description: row['Description'] || null,
          IGSTRate: toNumber(row['IGSTRate']),
          IGSTAmount: toNumber(row['IGSTAmount']),
          HSNCode: row['HSNCode'] || null,
          QNTY: toNumber(row['QNTY']),
          SparePart: row['SparePart'] || null,
          Unit: row['Unit'] || null,
          DiscountRate: toNumber(row['DiscountRate']),
          DiscountAmount: toNumber(row['DiscountAmount']),
          SalePrice: toNumber(row['SalePrice']),
          Amount: toNumber(row['Amount']),
          TaxableAmount: toNumber(row['TaxableAmount']),
          TotalAmount: toNumber(row['TotalAmount']),
        };
        try {
          const rec = await tx.servicedescription.create({ data });
          legacyToId.set(legacyId, rec.id);
          inserted++;
        } catch (err) {
          skipped++; console.error('ServiceDescription insert error for legacyId', legacyId, err.message || err);
        }
      }
    });
  }

  console.log(`servicedescription: inserted=${inserted} skipped=${skipped}`);
  return legacyToId;
}

async function importSparePartsBill(jobcardMap) {
  const file = path.join(CSV_DIR, 'Spare.csv');
  if (!fs.existsSync(file)) {
    console.log('Spare.csv not found, skipping sparepartsbill');
    return new Map();
  }
  const rows = await parseCsv(file);
  const legacyToId = new Map();
  let inserted = 0, skipped = 0;

  const spareChunks = chunkArray(rows, CHUNK_SIZE);
  for (const chunk of spareChunks) {
    await prisma.$transaction(async (tx) => {
      for (const row of chunk) {
        const legacyId = toNumber(row['SL']);
        if (!legacyId) { skipped++; console.warn('Spare skipped (no legacyId):', row); continue; }
        const serviceLegacy = toNumber(row['ServiceID']);
        const jobcardId = serviceLegacy ? jobcardMap.get(serviceLegacy) : null;
        if (serviceLegacy && !jobcardId) { skipped++; console.warn('Spare skipped (jobcard missing) legacy:', serviceLegacy); continue; }

        const data = {
          legacyId,
          jobcardId: jobcardId || undefined,
          ShopName: row['Shop_Name'] || null,
          Address: row['Address'] || null,
          BillDate: toDate(row['Bill_Date']) || undefined,
          BillNumber: row['Bill_Number'] || null,
          Amount: toNumber(row['Amount']),
          Paid: toNumber(row['Paid']),
          Paid_Date: toDate(row['Paid_Date']) || undefined,
          Bill_Returned: row['Bill_Returned'] || null,
          ReturnAmount: toNumber(row['Return_Amount']),
          ReturnedDate: toDate(row['Returned_Date']) || undefined,
          itemDescription: row['Item'] || null,
        };
        try {
          const rec = await tx.sparepartsbill.create({ data });
          legacyToId.set(legacyId, rec.id);
          inserted++;
        } catch (err) {
          skipped++; console.error('Spare insert error for legacyId', legacyId, err.message || err);
        }
      }
    });
  }

  console.log(`sparepartsbill: inserted=${inserted} skipped=${skipped}`);
  return legacyToId;
}

async function importEmployeeEarnings(jobcardMap, employeeMap) {
  const file = path.join(CSV_DIR, 'EmployeeIncome.csv');
  if (!fs.existsSync(file)) {
    console.log('EmployeeIncome.csv not found, skipping employeeEarning');
    return new Map();
  }
  const rows = await parseCsv(file);
  const legacyToId = new Map();
  let inserted = 0, skipped = 0;

  const earnChunks = chunkArray(rows, CHUNK_SIZE);
  for (const chunk of earnChunks) {
    await prisma.$transaction(async (tx) => {
      for (const row of chunk) {
        const legacyId = toNumber(row['EmployeeIncomeID']);
        if (!legacyId) { skipped++; console.warn('EmployeeEarning skipped (no legacyId):', row); continue; }
        const serviceLegacy = toNumber(row['ServiceID']);
        const jobcardId = serviceLegacy ? jobcardMap.get(serviceLegacy) : null;
        if (serviceLegacy && !jobcardId) { skipped++; console.warn('EmployeeEarning skipped (jobcard missing) legacy:', serviceLegacy); continue; }

        let employeeId = null;
        const employeeLegacy = toNumber(row['Employee']);
        if (employeeLegacy) employeeId = employeeMap.get(employeeLegacy) || null;

        const data = {
          legacyId,
          jobcardId: jobcardId || undefined,
          TransactionDate: toDate(row['TransactionDate']) || undefined,
          VehicleModel: row['VehicleModel'] || null,
          VehicleMake: row['VehicleMake'] || null,
          RegistrationNumber: row['RegistrationNumber'] || null,
          Employee: row['Employee'] || null,
          Amount: toNumber(row['Amount']),
          employeeId: employeeId || undefined,
        };
        try {
          const rec = await tx.employeeEarning.create({ data });
          legacyToId.set(legacyId, rec.id);
          inserted++;
        } catch (err) {
          skipped++; console.error('EmployeeEarning insert error for legacyId', legacyId, err.message || err);
        }
      }
    });
  }

  console.log(`employeeEarning: inserted=${inserted} skipped=${skipped}`);
  return legacyToId;
}

async function run() {
  console.log('Starting CSV -> Prisma migration');
    try {
      console.log('Starting migration...');

      const requested = process.env.MIGRATE_TABLES ? process.env.MIGRATE_TABLES.split(',').map(s => s.trim().toLowerCase()) : null;

      // If user asked for specific tables, we still need base mappings available.
      const needCustomers = !requested || requested.includes('customer') || (requested && requested.some(t => ['jobcard','servicedescription','sparepartsbill','employeeearning','employeeearning'].includes(t)));
      const needEmployees = !requested || requested.includes('employee') || (requested && requested.some(t => ['servicedescription','employeeearning'].includes(t)));
      const needVehicles = !requested || requested.includes('vehicle') || (requested && requested.some(t => ['jobcard','servicedescription','sparepartsbill'].includes(t)));

      let customerMap = new Map();
      let employeeMap = new Map();
      let vehicleMap = new Map();

      if (needCustomers) {
        customerMap = await importCustomers(true);
      }
      if (needEmployees) {
        employeeMap = await importEmployees(true);
      }
      if (needVehicles) {
        vehicleMap = await importVehicles(customerMap, true);
      }

      const order = ['customer','employee','vehicle','jobcard','servicedescription','sparepartsbill','employeeearning'];

      if (!requested) {
        // full run
        const jobcardMap = await importJobcards(customerMap, vehicleMap);
        await importServiceDescriptions(jobcardMap, employeeMap);
        await importSparePartsBill(jobcardMap);
        await importEmployeeEarnings(jobcardMap, employeeMap);
      } else {
        // run only requested tables but ensure dependencies already handled above
        for (const t of order) {
          if (!requested.includes(t)) continue;
          switch (t) {
            case 'customer':
              // already ran importCustomers when needed
              break;
            case 'employee':
              break;
            case 'vehicle':
              break;
            case 'jobcard': {
              const jobcardMap = await importJobcards(customerMap, vehicleMap);
              // if servicedescription also requested we will rely on this jobcardMap
              if (requested.includes('servicedescription')) {
                await importServiceDescriptions(jobcardMap, employeeMap);
              }
              break;
            }
            case 'servicedescription':
              // if jobcard wasn't requested but servicedescription was, we still need jobcardMap
              if (!requested.includes('jobcard')) {
                const jobcardMap = await importJobcards(customerMap, vehicleMap);
                await importServiceDescriptions(jobcardMap, employeeMap);
              }
              break;
            case 'sparepartsbill':
              if (!requested.includes('jobcard')) {
                const jobcardMap = await importJobcards(customerMap, vehicleMap);
                await importSparePartsBill(jobcardMap);
              } else {
                // jobcard handled earlier in loop
                // nothing to do here
              }
              break;
            case 'employeeearning':
              if (!requested.includes('jobcard')) {
                const jobcardMap = await importJobcards(customerMap, vehicleMap);
                await importEmployeeEarnings(jobcardMap, employeeMap);
              } else {
                // jobcard was already run earlier
              }
              break;
            default:
              break;
          }
        }
      }

      console.log('Migration finished');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
    console.log('Prisma disconnected');
  }
}

run();

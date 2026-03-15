require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function toNumber(val) {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function clearDatabase() {
  console.log("Clearing child tables first...");

  await prisma.serviceDescription.deleteMany();
  await prisma.sparePartsBill.deleteMany();
  await prisma.employeeEarning.deleteMany();
  await prisma.jobCard.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();

  console.log("All data cleared.");
}

async function importCustomers() {
  console.log("Importing Customers...");

  return new Promise((resolve, reject) => {
    fs.createReadStream("./csv/customers.csv")
      .pipe(csv())
      .on("data", async (row) => {
        try {
          await prisma.customer.create({
            data: {
              legacyId: toNumber(row.CustomerID),
              mobileNo: row.MobileNo || "NA-" + Math.random(),
              name: row.Name || "Unknown",
              email: row.Email || null,
              address: row.Address || null,
              city: row.City || null,
              state: row.State || null,
              gstin: row.GSTIN || null,
              pan: row.PAN || null,
              pincode: row.Pincode || null,
            },
          });
        } catch (err) {
          console.error("Customer error:", err.message);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

async function importVehicles() {
  console.log("Importing Vehicles...");

  return new Promise((resolve, reject) => {
    fs.createReadStream("./csv/vehicles.csv")
      .pipe(csv())
      .on("data", async (row) => {
        try {
          const customerLegacyId = toNumber(row.CustomerID);
          if (!customerLegacyId) return;

          const customer = await prisma.customer.findUnique({
            where: { legacyId: customerLegacyId },
          });

          if (!customer) return;

          await prisma.vehicle.create({
            data: {
              legacyId: toNumber(row.VehicleID),
              registrationNumber: row.RegistrationNumber,
              make: row.Make,
              model: row.Model,
              year: toNumber(row.Year),
              color: row.Color || null,
              customerId: customer.id,
            },
          });
        } catch (err) {
          console.error("Vehicle error:", err.message);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

async function importJobCards() {
  console.log("Importing JobCards...");

  return new Promise((resolve, reject) => {
    fs.createReadStream("./csv/jobcards.csv")
      .pipe(csv())
      .on("data", async (row) => {
        try {
          const vehicleLegacyId = toNumber(row.VehicleID);
          if (!vehicleLegacyId) return;

          const vehicle = await prisma.vehicle.findUnique({
            where: { legacyId: vehicleLegacyId },
          });

          if (!vehicle) return;

          await prisma.jobCard.create({
            data: {
              legacyId: toNumber(row.JobCardID),
              jobCardNumber: row.JobCardNumber,
              serviceDate: toDate(row.ServiceDate),
              customerId: vehicle.customerId,
              vehicleId: vehicle.id,
              total: toNumber(row.Total) || 0,
              paidAmount: toNumber(row.PaidAmount) || 0,
            },
          });
        } catch (err) {
          console.error("JobCard error:", err.message);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

async function importServiceDescriptions() {
  console.log("Importing ServiceDescriptions...");

  return new Promise((resolve, reject) => {
    fs.createReadStream("./csv/serviceDescriptions.csv")
      .pipe(csv())
      .on("data", async (row) => {
        try {
          const jobCardLegacyId = toNumber(row.JobCardID);
          if (!jobCardLegacyId) return;

          const jobCard = await prisma.jobCard.findUnique({
            where: { legacyId: jobCardLegacyId },
          });

          if (!jobCard) return;

          await prisma.serviceDescription.create({
            data: {
              legacyId: toNumber(row.ServiceDetailsID),
              sl: toNumber(row.SL) || 1,
              description: row.Description,
              qnty: toNumber(row.Quantity) || 1,
              salePrice: toNumber(row.SalePrice) || 0,
              amount: toNumber(row.Amount) || 0,
              jobCardId: jobCard.id,
            },
          });
        } catch (err) {
          console.error("ServiceDescription error:", err.message);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

async function main() {
  try {
    await clearDatabase();
    await importCustomers();
    await importVehicles();
    await importJobCards();
    await importServiceDescriptions();

    console.log("All imports completed successfully.");
  } catch (err) {
    console.error("Fatal error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
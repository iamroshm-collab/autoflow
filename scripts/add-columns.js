const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const run = async () => {
  try {
    console.log("Adding columns to AppUser...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "email" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "emailVerificationStatus" TEXT DEFAULT 'pending'`);
    console.log("✓ Columns added successfully");
    process.exit(0);
  } catch (error) {
    console.error("✗ Error adding columns:", error.message);
    process.exit(1);
  }
};

run();

-- CreateTable: Breakdown
CREATE TABLE "Breakdown" (
    "id" TEXT NOT NULL,
    "breakdownNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "breakdownType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "location" TEXT,
    "kmDriven" INTEGER,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "acceptedByUserId" TEXT,
    "acceptedByName" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "reachedGarageAt" TIMESTAMP(3),
    "reachedGarageByUserId" TEXT,
    "reachedGarageByName" TEXT,
    "jobCardId" TEXT,
    "transferredAt" TIMESTAMP(3),
    "transferredByUserId" TEXT,
    "transferredByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BreakdownMilestone
CREATE TABLE "BreakdownMilestone" (
    "id" TEXT NOT NULL,
    "breakdownId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorName" TEXT,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakdownMilestone_pkey" PRIMARY KEY ("id")
);

-- Unique Constraints
ALTER TABLE "Breakdown" ADD CONSTRAINT "Breakdown_breakdownNumber_key" UNIQUE ("breakdownNumber");
ALTER TABLE "Breakdown" ADD CONSTRAINT "Breakdown_jobCardId_key" UNIQUE ("jobCardId");

-- Indexes
CREATE INDEX "Breakdown_status_idx" ON "Breakdown"("status");
CREATE INDEX "Breakdown_breakdownType_idx" ON "Breakdown"("breakdownType");
CREATE INDEX "Breakdown_customerId_idx" ON "Breakdown"("customerId");
CREATE INDEX "Breakdown_vehicleId_idx" ON "Breakdown"("vehicleId");
CREATE INDEX "Breakdown_createdAt_idx" ON "Breakdown"("createdAt");
CREATE INDEX "BreakdownMilestone_breakdownId_idx" ON "BreakdownMilestone"("breakdownId");
CREATE INDEX "BreakdownMilestone_createdAt_idx" ON "BreakdownMilestone"("createdAt");

-- Foreign Keys
ALTER TABLE "Breakdown" ADD CONSTRAINT "Breakdown_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Breakdown" ADD CONSTRAINT "Breakdown_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Breakdown" ADD CONSTRAINT "Breakdown_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BreakdownMilestone" ADD CONSTRAINT "BreakdownMilestone_breakdownId_fkey" FOREIGN KEY ("breakdownId") REFERENCES "Breakdown"("id") ON DELETE CASCADE ON UPDATE CASCADE;

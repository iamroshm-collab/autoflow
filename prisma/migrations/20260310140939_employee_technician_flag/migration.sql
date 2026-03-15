-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "isTechnician" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TechnicianAllocations" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "jobDuration" INTEGER,
    "earningAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianAllocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceTokens" (
    "id" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceTokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnicianAllocations_jobId_idx" ON "TechnicianAllocations"("jobId");

-- CreateIndex
CREATE INDEX "TechnicianAllocations_employeeId_idx" ON "TechnicianAllocations"("employeeId");

-- CreateIndex
CREATE INDEX "TechnicianAllocations_status_idx" ON "TechnicianAllocations"("status");

-- CreateIndex
CREATE INDEX "TechnicianAllocations_assignedAt_idx" ON "TechnicianAllocations"("assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceTokens_token_key" ON "DeviceTokens"("token");

-- CreateIndex
CREATE INDEX "DeviceTokens_employeeId_idx" ON "DeviceTokens"("employeeId");

-- CreateIndex
CREATE INDEX "Employee_isTechnician_idx" ON "Employee"("isTechnician");

-- AddForeignKey
ALTER TABLE "TechnicianAllocations" ADD CONSTRAINT "TechnicianAllocations_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianAllocations" ADD CONSTRAINT "TechnicianAllocations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTokens" ADD CONSTRAINT "DeviceTokens_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId") ON DELETE CASCADE ON UPDATE CASCADE;

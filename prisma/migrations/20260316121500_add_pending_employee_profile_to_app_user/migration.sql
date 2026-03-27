ALTER TABLE "AppUser"
ADD COLUMN "mobile" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "idNumber" TEXT,
ADD COLUMN "designation" TEXT,
ADD COLUMN "employeeRefId" INTEGER;

CREATE UNIQUE INDEX "AppUser_employeeRefId_key" ON "AppUser"("employeeRefId");
CREATE INDEX "AppUser_mobile_idx" ON "AppUser"("mobile");

ALTER TABLE "AppUser"
ADD CONSTRAINT "AppUser_employeeRefId_fkey"
FOREIGN KEY ("employeeRefId") REFERENCES "Employee"("employeeId")
ON DELETE SET NULL ON UPDATE CASCADE;

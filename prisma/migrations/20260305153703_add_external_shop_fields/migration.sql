-- AlterTable
ALTER TABLE "JobCard" ADD COLUMN     "externalShop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalShopRemarks" TEXT;

-- CreateTable
CREATE TABLE "VehicleMakeModel" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Car',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMakeModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartShop" (
    "id" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "address" TEXT,
    "mobile" TEXT,
    "pan" TEXT,
    "gstin" TEXT,
    "stateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePartShop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleMakeModel_make_idx" ON "VehicleMakeModel"("make");

-- CreateIndex
CREATE INDEX "VehicleMakeModel_category_idx" ON "VehicleMakeModel"("category");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMakeModel_make_model_key" ON "VehicleMakeModel"("make", "model");

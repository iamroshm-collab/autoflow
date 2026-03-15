DROP TABLE IF EXISTS "SaleDetails";
DROP TABLE IF EXISTS "Sale";
DROP TABLE IF EXISTS "PurchaseDetails";
DROP TABLE IF EXISTS "Purchase";

CREATE TABLE "Purchase" (
  "PurchaseID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "PurchaseDate" DATETIME NOT NULL,
  "SupplierID" INTEGER NOT NULL,
  "Supplier" TEXT NOT NULL,
  "Address" TEXT,
  "MobileNo" TEXT,
  "GSTIN" TEXT,
  "PAN" TEXT,
  "StateID" TEXT,
  "RefDocument" TEXT,
  "Taxable" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Purchase_SupplierID_fkey"
    FOREIGN KEY ("SupplierID") REFERENCES "Suppliers" ("SupplierID")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Purchase_SupplierID_idx" ON "Purchase"("SupplierID");
CREATE INDEX "Purchase_PurchaseDate_idx" ON "Purchase"("PurchaseDate");

CREATE TABLE "PurchaseDetails" (
  "PurchaseDetailsID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "PurchaseID" INTEGER NOT NULL,
  "ProductID" INTEGER NOT NULL,
  "Product" TEXT NOT NULL,
  "ProductDescription" TEXT,
  "HSN" TEXT,
  "Qnty" REAL NOT NULL DEFAULT 0,
  "Unit" TEXT,
  "PurchasePrice" REAL NOT NULL DEFAULT 0,
  "MRP" REAL NOT NULL DEFAULT 0,
  "SalePrice" REAL NOT NULL DEFAULT 0,
  "SGSTRate" REAL NOT NULL DEFAULT 0,
  "CGSTRate" REAL NOT NULL DEFAULT 0,
  "Amount" REAL NOT NULL DEFAULT 0,
  "SGSTAmount" REAL NOT NULL DEFAULT 0,
  "CGSTAmount" REAL NOT NULL DEFAULT 0,
  "IGSTAmount" REAL NOT NULL DEFAULT 0,
  "TotalAmount" REAL NOT NULL DEFAULT 0,
  "BalanceStock" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PurchaseDetails_PurchaseID_fkey"
    FOREIGN KEY ("PurchaseID") REFERENCES "Purchase" ("PurchaseID")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseDetails_ProductID_fkey"
    FOREIGN KEY ("ProductID") REFERENCES "Products" ("ProductID")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PurchaseDetails_PurchaseID_idx" ON "PurchaseDetails"("PurchaseID");
CREATE INDEX "PurchaseDetails_ProductID_idx" ON "PurchaseDetails"("ProductID");

CREATE TABLE "Sale" (
  "SaleID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "VehicleID" TEXT,
  "CategoryID" TEXT,
  "BillNumber" TEXT NOT NULL,
  "Prefix" TEXT,
  "BillDate" DATETIME NOT NULL,
  "Customer" TEXT NOT NULL,
  "Address" TEXT,
  "MobileNo" TEXT,
  "VehicleReg" TEXT,
  "BillType" TEXT,
  "SaleType" TEXT,
  "DespatchTime" DATETIME,
  "GSTIN" TEXT,
  "StateCode" TEXT,
  "Taxable" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Sale_VehicleID_fkey"
    FOREIGN KEY ("VehicleID") REFERENCES "Vehicle" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Sale_VehicleID_idx" ON "Sale"("VehicleID");
CREATE INDEX "Sale_BillDate_idx" ON "Sale"("BillDate");
CREATE INDEX "Sale_BillNumber_idx" ON "Sale"("BillNumber");

CREATE TABLE "SaleDetails" (
  "SaleDetailsID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "SaleID" INTEGER NOT NULL,
  "ProductID" INTEGER NOT NULL,
  "Product" TEXT NOT NULL,
  "ProductDescription" TEXT,
  "PurchasePrice" REAL NOT NULL DEFAULT 0,
  "PurchaseDetailsID" INTEGER,
  "HSN" TEXT,
  "SalePrice" REAL NOT NULL DEFAULT 0,
  "Unit" TEXT,
  "Qnty" REAL NOT NULL DEFAULT 0,
  "ReturnQnty" REAL NOT NULL DEFAULT 0,
  "ReturnDate" DATETIME,
  "Discount" REAL NOT NULL DEFAULT 0,
  "SGSTRate" REAL NOT NULL DEFAULT 0,
  "CGSTRate" REAL NOT NULL DEFAULT 0,
  "Amount" REAL NOT NULL DEFAULT 0,
  "DiscountAmount" REAL NOT NULL DEFAULT 0,
  "AccessAmount" REAL NOT NULL DEFAULT 0,
  "SGSTAmount" REAL NOT NULL DEFAULT 0,
  "CGSTAmount" REAL NOT NULL DEFAULT 0,
  "IGSTRate" REAL NOT NULL DEFAULT 0,
  "IGSTAmount" REAL NOT NULL DEFAULT 0,
  "TotalAmount" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SaleDetails_SaleID_fkey"
    FOREIGN KEY ("SaleID") REFERENCES "Sale" ("SaleID")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SaleDetails_ProductID_fkey"
    FOREIGN KEY ("ProductID") REFERENCES "Products" ("ProductID")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SaleDetails_PurchaseDetailsID_fkey"
    FOREIGN KEY ("PurchaseDetailsID") REFERENCES "PurchaseDetails" ("PurchaseDetailsID")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SaleDetails_SaleID_idx" ON "SaleDetails"("SaleID");
CREATE INDEX "SaleDetails_ProductID_idx" ON "SaleDetails"("ProductID");
CREATE INDEX "SaleDetails_PurchaseDetailsID_idx" ON "SaleDetails"("PurchaseDetailsID");

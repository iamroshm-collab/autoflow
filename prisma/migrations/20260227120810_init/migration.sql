-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "mobileNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "pincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "registrationNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "color" TEXT,
    "lastCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCard" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "jobCardNumber" TEXT NOT NULL,
    "shopCode" TEXT NOT NULL DEFAULT 'AL',
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "fileNo" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "kmDriven" INTEGER,
    "nextServiceKM" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advancePayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidDate" TIMESTAMP(3),
    "vehicleStatus" TEXT,
    "jobcardStatus" TEXT NOT NULL DEFAULT 'Under Service',
    "jobcardPaymentStatus" TEXT NOT NULL DEFAULT 'Pending',
    "electrical" BOOLEAN NOT NULL DEFAULT false,
    "ac" BOOLEAN NOT NULL DEFAULT false,
    "mechanical" BOOLEAN NOT NULL DEFAULT false,
    "others" BOOLEAN NOT NULL DEFAULT false,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDescription" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "sl" INTEGER NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "igstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hsnCode" TEXT,
    "qnty" INTEGER NOT NULL DEFAULT 1,
    "sparePart" TEXT,
    "unit" TEXT,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceDescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartsBill" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "sl" INTEGER NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "address" TEXT,
    "vehicleMake" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "billNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidDate" TIMESTAMP(3),
    "billReturned" BOOLEAN NOT NULL DEFAULT false,
    "returnAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedDate" TIMESTAMP(3),
    "itemDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePartsBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEarning" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "sl" INTEGER NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehicleMake" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "employee" TEXT NOT NULL,
    "employeeID" TEXT NOT NULL,
    "workType" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialTransactions" (
    "ID" SERIAL NOT NULL,
    "Transaction_Type" TEXT NOT NULL,
    "Transaction_Date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Description" TEXT NOT NULL,
    "Vehicle" TEXT,
    "jobCardId" TEXT,
    "Employee" INTEGER,
    "Payment_Type" TEXT NOT NULL,
    "Transaction_Amount" DOUBLE PRECISION NOT NULL,
    "RecordTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Customer_Name" TEXT,
    "Mobile_Number" TEXT,
    "Vehicle_Make" TEXT,

    CONSTRAINT "FinancialTransactions_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Employee" (
    "employeeId" SERIAL NOT NULL,
    "empName" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "address" TEXT,
    "designation" TEXT,
    "salaryPerday" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "attendance" TEXT,
    "attendanceDate" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "AttendancePayroll" (
    "attendanceId" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "attendance" TEXT NOT NULL,
    "salaryAdvance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incentive" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePayroll_pkey" PRIMARY KEY ("attendanceId")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "noteNumber" TEXT NOT NULL,
    "noteDate" TIMESTAMP(3) NOT NULL,
    "party" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "gstin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjustment" (
    "adjustmentId" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustmentDate" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adjustment_pkey" PRIMARY KEY ("adjustmentId")
);

-- CreateTable
CREATE TABLE "MonthlyPayroll" (
    "payrollId" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPresent" INTEGER NOT NULL DEFAULT 0,
    "totalHalfDay" INTEGER NOT NULL DEFAULT 0,
    "totalLeave" INTEGER NOT NULL DEFAULT 0,
    "totalAbsent" INTEGER NOT NULL DEFAULT 0,
    "totalAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIncentive" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAdvance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,

    CONSTRAINT "MonthlyPayroll_pkey" PRIMARY KEY ("payrollId")
);

-- CreateTable
CREATE TABLE "States" (
    "StateID" TEXT NOT NULL,
    "StateName" TEXT NOT NULL,
    "StateCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "States_pkey" PRIMARY KEY ("StateID")
);

-- CreateTable
CREATE TABLE "Categories" (
    "CategoryID" TEXT NOT NULL,
    "CategoryName" TEXT NOT NULL,
    "Description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categories_pkey" PRIMARY KEY ("CategoryID")
);

-- CreateTable
CREATE TABLE "Suppliers" (
    "SupplierID" SERIAL NOT NULL,
    "SupplierName" TEXT NOT NULL,
    "Address" TEXT,
    "MobileNo" TEXT NOT NULL,
    "StateID" TEXT,
    "StateCode" TEXT,
    "GSTIN" TEXT,
    "PAN" TEXT,
    "IsRegistered" BOOLEAN NOT NULL DEFAULT false,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suppliers_pkey" PRIMARY KEY ("SupplierID")
);

-- CreateTable
CREATE TABLE "Products" (
    "ProductID" SERIAL NOT NULL,
    "SupplierID" INTEGER NOT NULL,
    "CategoryID" TEXT,
    "ProductName" TEXT NOT NULL,
    "Unit" TEXT,
    "ProductDescription" TEXT,
    "HSNCode" TEXT,
    "MRP" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "CGSTRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "PurchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SalePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SGSTRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "IGSTRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "GSTPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "IsTaxable" BOOLEAN NOT NULL DEFAULT true,
    "IsInclusive" BOOLEAN NOT NULL DEFAULT false,
    "BalanceStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Products_pkey" PRIMARY KEY ("ProductID")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "PurchaseID" SERIAL NOT NULL,
    "PurchaseDate" TIMESTAMP(3) NOT NULL,
    "SupplierID" INTEGER NOT NULL,
    "BranchID" INTEGER,
    "Supplier" TEXT NOT NULL,
    "Address" TEXT,
    "MobileNo" TEXT,
    "GSTIN" TEXT,
    "SupplierGSTIN" TEXT,
    "PAN" TEXT,
    "StateID" TEXT,
    "PlaceOfSupplyStateCode" TEXT,
    "RefDocument" TEXT,
    "billNumber" TEXT,
    "Taxable" BOOLEAN NOT NULL DEFAULT true,
    "InvoiceType" TEXT,
    "TotalTaxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalCGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalSGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalIGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "GrandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("PurchaseID")
);

-- CreateTable
CREATE TABLE "PurchaseDetails" (
    "PurchaseDetailsID" SERIAL NOT NULL,
    "PurchaseID" INTEGER NOT NULL,
    "ProductID" INTEGER NOT NULL,
    "Product" TEXT NOT NULL,
    "ProductDescription" TEXT,
    "HSN" TEXT,
    "GSTPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TaxableValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "Qnty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "Unit" TEXT,
    "PurchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "MRP" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SalePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SGSTRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "CGSTRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "Amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SGSTAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "CGSTAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "IGSTAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "BalanceStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseDetails_pkey" PRIMARY KEY ("PurchaseDetailsID")
);

-- CreateTable
CREATE TABLE "Sale" (
    "SaleID" SERIAL NOT NULL,
    "BranchID" INTEGER,
    "VehicleID" TEXT,
    "CategoryID" TEXT,
    "billNumber" TEXT NOT NULL,
    "Prefix" TEXT,
    "BillDate" TIMESTAMP(3) NOT NULL,
    "Customer" TEXT NOT NULL,
    "Address" TEXT,
    "MobileNo" TEXT,
    "VehicleReg" TEXT,
    "BillType" TEXT,
    "SaleType" TEXT,
    "DespatchTime" TIMESTAMP(3),
    "GSTIN" TEXT,
    "CustomerGSTIN" TEXT,
    "StateCode" TEXT,
    "PlaceOfSupplyStateCode" TEXT,
    "Taxable" BOOLEAN NOT NULL DEFAULT true,
    "InvoiceType" TEXT,
    "TotalTaxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalCGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalSGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalIGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "GrandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("SaleID")
);

-- CreateTable
CREATE TABLE "SaleDetails" (
    "SaleDetailsID" SERIAL NOT NULL,
    "SaleID" INTEGER NOT NULL,
    "ProductID" INTEGER NOT NULL,
    "Product" TEXT NOT NULL,
    "ProductDescription" TEXT,
    "PurchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "PurchaseDetailsID" INTEGER,
    "HSN" TEXT,
    "GSTPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TaxableValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SalePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "Unit" TEXT,
    "Qnty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ReturnQnty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ReturnDate" TIMESTAMP(3),
    "Discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SGSTRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "CGSTRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "Amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "DiscountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "AccessAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SGSTAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "CGSTAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "IGSTRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "IGSTAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleDetails_pkey" PRIMARY KEY ("SaleDetailsID")
);

-- CreateTable
CREATE TABLE "Branches" (
    "BranchID" SERIAL NOT NULL,
    "BranchName" TEXT NOT NULL,
    "StateCode" TEXT NOT NULL,
    "GSTIN" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branches_pkey" PRIMARY KEY ("BranchID")
);

-- CreateTable
CREATE TABLE "ITC_Ledger" (
    "ID" SERIAL NOT NULL,
    "BranchID" INTEGER NOT NULL,
    "SourceType" TEXT NOT NULL,
    "SourceID" INTEGER NOT NULL,
    "IGSTCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "CGSTCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SGSTCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "UtilizedIGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "UtilizedCGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "UtilizedSGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "BalanceIGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "BalanceCGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "BalanceSGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ITC_Ledger_pkey" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "CreditNoteHeader" (
    "CreditNoteID" SERIAL NOT NULL,
    "SaleID" INTEGER NOT NULL,
    "BranchID" INTEGER NOT NULL,
    "CreditNoteNumber" TEXT NOT NULL,
    "CreditNoteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Reason" TEXT,
    "TotalTaxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalCGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalSGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TotalIGST" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "GrandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "CreditNoteHeader_pkey" PRIMARY KEY ("CreditNoteID")
);

-- CreateTable
CREATE TABLE "CreditNoteDetails" (
    "CreditNoteDetailID" SERIAL NOT NULL,
    "CreditNoteID" INTEGER NOT NULL,
    "SaleDetailsID" INTEGER,
    "ProductID" INTEGER,
    "HSNCode" TEXT,
    "GSTPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "TaxableValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "CGSTAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "SGSTAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "IGSTAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "Quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "CreditNoteDetails_pkey" PRIMARY KEY ("CreditNoteDetailID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_legacyId_key" ON "Customer"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mobileNo_key" ON "Customer"("mobileNo");

-- CreateIndex
CREATE INDEX "Customer_mobileNo_idx" ON "Customer"("mobileNo");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_legacyId_key" ON "Vehicle"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE INDEX "Vehicle_registrationNumber_idx" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JobCard_legacyId_key" ON "JobCard"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "JobCard_jobCardNumber_key" ON "JobCard"("jobCardNumber");

-- CreateIndex
CREATE INDEX "JobCard_jobCardNumber_idx" ON "JobCard"("jobCardNumber");

-- CreateIndex
CREATE INDEX "JobCard_customerId_idx" ON "JobCard"("customerId");

-- CreateIndex
CREATE INDEX "JobCard_vehicleId_idx" ON "JobCard"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDescription_legacyId_key" ON "ServiceDescription"("legacyId");

-- CreateIndex
CREATE INDEX "ServiceDescription_jobCardId_idx" ON "ServiceDescription"("jobCardId");

-- CreateIndex
CREATE INDEX "ServiceDescription_sl_jobCardId_idx" ON "ServiceDescription"("sl", "jobCardId");

-- CreateIndex
CREATE UNIQUE INDEX "SparePartsBill_legacyId_key" ON "SparePartsBill"("legacyId");

-- CreateIndex
CREATE INDEX "SparePartsBill_jobCardId_idx" ON "SparePartsBill"("jobCardId");

-- CreateIndex
CREATE INDEX "SparePartsBill_sl_jobCardId_idx" ON "SparePartsBill"("sl", "jobCardId");

-- CreateIndex
CREATE INDEX "SparePartsBill_billNumber_idx" ON "SparePartsBill"("billNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeEarning_legacyId_key" ON "EmployeeEarning"("legacyId");

-- CreateIndex
CREATE INDEX "EmployeeEarning_jobCardId_idx" ON "EmployeeEarning"("jobCardId");

-- CreateIndex
CREATE INDEX "EmployeeEarning_sl_jobCardId_idx" ON "EmployeeEarning"("sl", "jobCardId");

-- CreateIndex
CREATE INDEX "EmployeeEarning_employeeID_idx" ON "EmployeeEarning"("employeeID");

-- CreateIndex
CREATE INDEX "FinancialTransactions_Transaction_Date_idx" ON "FinancialTransactions"("Transaction_Date");

-- CreateIndex
CREATE INDEX "FinancialTransactions_Transaction_Type_idx" ON "FinancialTransactions"("Transaction_Type");

-- CreateIndex
CREATE INDEX "FinancialTransactions_Employee_idx" ON "FinancialTransactions"("Employee");

-- CreateIndex
CREATE INDEX "FinancialTransactions_Vehicle_idx" ON "FinancialTransactions"("Vehicle");

-- CreateIndex
CREATE INDEX "FinancialTransactions_jobCardId_idx" ON "FinancialTransactions"("jobCardId");

-- CreateIndex
CREATE INDEX "Employee_empName_idx" ON "Employee"("empName");

-- CreateIndex
CREATE INDEX "Employee_mobile_idx" ON "Employee"("mobile");

-- CreateIndex
CREATE INDEX "Employee_isArchived_idx" ON "Employee"("isArchived");

-- CreateIndex
CREATE INDEX "AttendancePayroll_employeeId_attendanceDate_idx" ON "AttendancePayroll"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "AttendancePayroll_attendanceDate_idx" ON "AttendancePayroll"("attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePayroll_employeeId_attendanceDate_key" ON "AttendancePayroll"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "Note_noteType_idx" ON "Note"("noteType");

-- CreateIndex
CREATE INDEX "Note_noteDate_idx" ON "Note"("noteDate");

-- CreateIndex
CREATE UNIQUE INDEX "Note_noteNumber_noteType_key" ON "Note"("noteNumber", "noteType");

-- CreateIndex
CREATE INDEX "Adjustment_employeeId_idx" ON "Adjustment"("employeeId");

-- CreateIndex
CREATE INDEX "Adjustment_adjustmentDate_idx" ON "Adjustment"("adjustmentDate");

-- CreateIndex
CREATE INDEX "Adjustment_adjustmentType_idx" ON "Adjustment"("adjustmentType");

-- CreateIndex
CREATE INDEX "MonthlyPayroll_month_year_idx" ON "MonthlyPayroll"("month", "year");

-- CreateIndex
CREATE INDEX "MonthlyPayroll_employeeId_idx" ON "MonthlyPayroll"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPayroll_employeeId_month_year_key" ON "MonthlyPayroll"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX "Suppliers_MobileNo_idx" ON "Suppliers"("MobileNo");

-- CreateIndex
CREATE INDEX "Products_SupplierID_idx" ON "Products"("SupplierID");

-- CreateIndex
CREATE INDEX "Products_CategoryID_idx" ON "Products"("CategoryID");

-- CreateIndex
CREATE INDEX "Purchase_SupplierID_idx" ON "Purchase"("SupplierID");

-- CreateIndex
CREATE INDEX "Purchase_BranchID_idx" ON "Purchase"("BranchID");

-- CreateIndex
CREATE INDEX "Purchase_PurchaseDate_idx" ON "Purchase"("PurchaseDate");

-- CreateIndex
CREATE INDEX "Purchase_billNumber_idx" ON "Purchase"("billNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_SupplierID_billNumber_key" ON "Purchase"("SupplierID", "billNumber");

-- CreateIndex
CREATE INDEX "PurchaseDetails_PurchaseID_idx" ON "PurchaseDetails"("PurchaseID");

-- CreateIndex
CREATE INDEX "PurchaseDetails_ProductID_idx" ON "PurchaseDetails"("ProductID");

-- CreateIndex
CREATE INDEX "Sale_BranchID_idx" ON "Sale"("BranchID");

-- CreateIndex
CREATE INDEX "Sale_VehicleID_idx" ON "Sale"("VehicleID");

-- CreateIndex
CREATE INDEX "Sale_BillDate_idx" ON "Sale"("BillDate");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_billNumber_key" ON "Sale"("billNumber");

-- CreateIndex
CREATE INDEX "SaleDetails_SaleID_idx" ON "SaleDetails"("SaleID");

-- CreateIndex
CREATE INDEX "SaleDetails_ProductID_idx" ON "SaleDetails"("ProductID");

-- CreateIndex
CREATE INDEX "SaleDetails_PurchaseDetailsID_idx" ON "SaleDetails"("PurchaseDetailsID");

-- CreateIndex
CREATE INDEX "Branches_StateCode_idx" ON "Branches"("StateCode");

-- CreateIndex
CREATE INDEX "Branches_GSTIN_idx" ON "Branches"("GSTIN");

-- CreateIndex
CREATE INDEX "ITC_Ledger_BranchID_idx" ON "ITC_Ledger"("BranchID");

-- CreateIndex
CREATE INDEX "ITC_Ledger_SourceType_SourceID_idx" ON "ITC_Ledger"("SourceType", "SourceID");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNoteHeader_CreditNoteNumber_key" ON "CreditNoteHeader"("CreditNoteNumber");

-- CreateIndex
CREATE INDEX "CreditNoteHeader_SaleID_idx" ON "CreditNoteHeader"("SaleID");

-- CreateIndex
CREATE INDEX "CreditNoteHeader_BranchID_idx" ON "CreditNoteHeader"("BranchID");

-- CreateIndex
CREATE INDEX "CreditNoteDetails_CreditNoteID_idx" ON "CreditNoteDetails"("CreditNoteID");

-- CreateIndex
CREATE INDEX "CreditNoteDetails_SaleDetailsID_idx" ON "CreditNoteDetails"("SaleDetailsID");

-- CreateIndex
CREATE INDEX "CreditNoteDetails_ProductID_idx" ON "CreditNoteDetails"("ProductID");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_lastCustomerId_fkey" FOREIGN KEY ("lastCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDescription" ADD CONSTRAINT "ServiceDescription_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartsBill" ADD CONSTRAINT "SparePartsBill_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEarning" ADD CONSTRAINT "EmployeeEarning_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransactions" ADD CONSTRAINT "FinancialTransactions_Vehicle_fkey" FOREIGN KEY ("Vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransactions" ADD CONSTRAINT "FinancialTransactions_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransactions" ADD CONSTRAINT "FinancialTransactions_Employee_fkey" FOREIGN KEY ("Employee") REFERENCES "Employee"("employeeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePayroll" ADD CONSTRAINT "AttendancePayroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPayroll" ADD CONSTRAINT "MonthlyPayroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_SupplierID_fkey" FOREIGN KEY ("SupplierID") REFERENCES "Suppliers"("SupplierID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_CategoryID_fkey" FOREIGN KEY ("CategoryID") REFERENCES "Categories"("CategoryID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_SupplierID_fkey" FOREIGN KEY ("SupplierID") REFERENCES "Suppliers"("SupplierID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_BranchID_fkey" FOREIGN KEY ("BranchID") REFERENCES "Branches"("BranchID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDetails" ADD CONSTRAINT "PurchaseDetails_PurchaseID_fkey" FOREIGN KEY ("PurchaseID") REFERENCES "Purchase"("PurchaseID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDetails" ADD CONSTRAINT "PurchaseDetails_ProductID_fkey" FOREIGN KEY ("ProductID") REFERENCES "Products"("ProductID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_VehicleID_fkey" FOREIGN KEY ("VehicleID") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_BranchID_fkey" FOREIGN KEY ("BranchID") REFERENCES "Branches"("BranchID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleDetails" ADD CONSTRAINT "SaleDetails_SaleID_fkey" FOREIGN KEY ("SaleID") REFERENCES "Sale"("SaleID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleDetails" ADD CONSTRAINT "SaleDetails_ProductID_fkey" FOREIGN KEY ("ProductID") REFERENCES "Products"("ProductID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleDetails" ADD CONSTRAINT "SaleDetails_PurchaseDetailsID_fkey" FOREIGN KEY ("PurchaseDetailsID") REFERENCES "PurchaseDetails"("PurchaseDetailsID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITC_Ledger" ADD CONSTRAINT "ITC_Ledger_BranchID_fkey" FOREIGN KEY ("BranchID") REFERENCES "Branches"("BranchID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteHeader" ADD CONSTRAINT "CreditNoteHeader_SaleID_fkey" FOREIGN KEY ("SaleID") REFERENCES "Sale"("SaleID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteHeader" ADD CONSTRAINT "CreditNoteHeader_BranchID_fkey" FOREIGN KEY ("BranchID") REFERENCES "Branches"("BranchID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteDetails" ADD CONSTRAINT "CreditNoteDetails_CreditNoteID_fkey" FOREIGN KEY ("CreditNoteID") REFERENCES "CreditNoteHeader"("CreditNoteID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteDetails" ADD CONSTRAINT "CreditNoteDetails_SaleDetailsID_fkey" FOREIGN KEY ("SaleDetailsID") REFERENCES "SaleDetails"("SaleDetailsID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteDetails" ADD CONSTRAINT "CreditNoteDetails_ProductID_fkey" FOREIGN KEY ("ProductID") REFERENCES "Products"("ProductID") ON DELETE SET NULL ON UPDATE CASCADE;

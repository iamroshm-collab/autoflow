DROP TABLE IF EXISTS "FinancialTransactions";

CREATE TABLE "FinancialTransactions" (
  "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
  "Transaction_Type" TEXT NOT NULL CHECK ("Transaction_Type" IN ('Income', 'Expense')),
  "Transaction_Date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "Description" TEXT NOT NULL,
  "Vehicle" TEXT,
  "Employee" INTEGER,
  "Payment_Type" TEXT NOT NULL CHECK ("Payment_Type" IN ('Cash', 'Bank Transfer', 'UPI')),
  "Transaction_Amount" DECIMAL(12, 2) NOT NULL,
  "RecordTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("Vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("Employee") REFERENCES "Employee"("employeeId") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_financial_txn_date" ON "FinancialTransactions"("Transaction_Date");
CREATE INDEX IF NOT EXISTS "idx_financial_txn_type" ON "FinancialTransactions"("Transaction_Type");
CREATE INDEX IF NOT EXISTS "idx_financial_txn_employee" ON "FinancialTransactions"("Employee");
CREATE INDEX IF NOT EXISTS "idx_financial_txn_vehicle" ON "FinancialTransactions"("Vehicle");

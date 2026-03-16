-- CreateTable
CREATE TABLE "InventoryMovement" (
  "ID" SERIAL NOT NULL,
  "ItemID" INTEGER NOT NULL,
  "MovementType" TEXT NOT NULL,
  "Quantity" INTEGER NOT NULL,
  "ReferenceType" TEXT NOT NULL,
  "ReferenceID" INTEGER,
  "Remarks" TEXT,
  "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("ID")
);

-- CreateIndex
CREATE INDEX "InventoryMovement_ItemID_idx" ON "InventoryMovement"("ItemID");

-- CreateIndex
CREATE INDEX "InventoryMovement_CreatedAt_idx" ON "InventoryMovement"("CreatedAt");

-- AddForeignKey
ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_ItemID_fkey"
FOREIGN KEY ("ItemID") REFERENCES "Products"("ProductID")
ON DELETE RESTRICT ON UPDATE CASCADE;

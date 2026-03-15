-- First, clear invalid stateId values that don't exist in States table
UPDATE "SparePartShop" SET "stateId" = NULL WHERE "stateId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "SparePartShop" ADD CONSTRAINT "SparePartShop_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "States"("StateID") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add refType and refId to AppNotification for deduplication and removal by reference
ALTER TABLE "AppNotification" ADD COLUMN "refType" TEXT;
ALTER TABLE "AppNotification" ADD COLUMN "refId"   TEXT;

-- Index to make removal/dedup queries fast
CREATE INDEX "AppNotification_refType_refId_idx" ON "AppNotification"("refType", "refId");

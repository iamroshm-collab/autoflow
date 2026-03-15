-- Backfill missing supplier StateCode from the state master using legacy StateID
UPDATE "Suppliers" AS s
SET "StateCode" = st."StateCode"
FROM "States" AS st
WHERE s."StateID" IS NOT NULL
  AND st."StateID" = s."StateID"
  AND (s."StateCode" IS NULL OR btrim(s."StateCode") = '');

-- If legacy StateID already stores a 2-digit GST code, keep it as StateCode
UPDATE "Suppliers"
SET "StateCode" = "StateID"
WHERE "StateID" IS NOT NULL
  AND "StateID" ~ '^[0-9]{2}$'
  AND ("StateCode" IS NULL OR btrim("StateCode") = '');

-- Remove legacy supplier StateID column; supplier state now uses StateCode
ALTER TABLE "Suppliers" DROP COLUMN "StateID";

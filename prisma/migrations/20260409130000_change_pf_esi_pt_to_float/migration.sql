ALTER TABLE "Employee" ALTER COLUMN pf_applicable DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN esi_applicable DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN professional_tax_applicable DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN pf_applicable TYPE DOUBLE PRECISION USING CASE WHEN lower(coalesce(pf_applicable::text, '')) IN ('t', 'true', '1', '1.0') THEN 1 ELSE 0 END;
ALTER TABLE "Employee" ALTER COLUMN esi_applicable TYPE DOUBLE PRECISION USING CASE WHEN lower(coalesce(esi_applicable::text, '')) IN ('t', 'true', '1', '1.0') THEN 1 ELSE 0 END;
ALTER TABLE "Employee" ALTER COLUMN professional_tax_applicable TYPE DOUBLE PRECISION USING CASE WHEN lower(coalesce(professional_tax_applicable::text, '')) IN ('t', 'true', '1', '1.0') THEN 1 ELSE 0 END;
ALTER TABLE "Employee" ALTER COLUMN pf_applicable SET DEFAULT 0;
ALTER TABLE "Employee" ALTER COLUMN esi_applicable SET DEFAULT 0;
ALTER TABLE "Employee" ALTER COLUMN professional_tax_applicable SET DEFAULT 0;

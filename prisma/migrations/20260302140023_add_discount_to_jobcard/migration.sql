-- Add discount column to JobCard table
ALTER TABLE "JobCard" ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;

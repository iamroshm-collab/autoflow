-- Migration: add Holiday model
-- Generated: 2026-04-06

BEGIN;

CREATE TABLE IF NOT EXISTS "Holiday" (
  "id" serial PRIMARY KEY,
  "date" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "createdAt" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Holiday_date_idx" ON "Holiday" ("date");

COMMIT;

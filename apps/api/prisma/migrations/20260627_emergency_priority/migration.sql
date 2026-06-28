-- Add priority/fallback ordering to emergency contacts
ALTER TABLE "EmergencyContact" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
-- Per-tour emergency contact selection: having many contacts on file
-- doesn't mean all of them are relevant for every single hike. This
-- stores an ordered array of EmergencyContact ids (max 3) chosen for a
-- specific tour; null means "fall back to account default order".
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "emergencyContactIds" JSONB;

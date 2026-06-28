-- Add interactive map fields for parking location and tour waypoints
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "parkingLat" DOUBLE PRECISION;
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "parkingLng" DOUBLE PRECISION;
ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "waypoints" JSONB;

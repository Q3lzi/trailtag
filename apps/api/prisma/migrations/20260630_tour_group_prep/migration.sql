-- Shared-hike prep phase: route lives on the group itself (so it can be
-- shown before anyone has joined/created their own Tour), a start mode
-- decided once at creation, a suggested return time, and a lightweight
-- message board for pre-hike coordination.

ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "startMode" TEXT NOT NULL DEFAULT 'EACH_OWN';
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "suggestedEta" TIMESTAMP(3);
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "startLat" DOUBLE PRECISION;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "startLng" DOUBLE PRECISION;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "gpxTrack" JSONB;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "waypoints" JSONB;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "overnightStops" JSONB;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "parkingLocation" TEXT;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "parkingLat" DOUBLE PRECISION;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "parkingLng" DOUBLE PRECISION;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "distanceKm" DOUBLE PRECISION;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "elevationUp" INTEGER;
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

CREATE TABLE "TourGroupMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TourGroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TourGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TourGroupMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Planned start date/time for the shared hike, separate from the suggested
-- return time, so a multi-day or future-dated group tour can be planned
-- properly instead of only carrying a return-time-of-day.
ALTER TABLE "TourGroup" ADD COLUMN IF NOT EXISTS "suggestedStartAt" TIMESTAMP(3);

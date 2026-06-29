-- Shared tours: a TourGroup ties together multiple individual Tour rows
-- (one per participant) for a hike done together. Each Tour keeps its own
-- ETA/emergency-contact escalation — only the group context and route are
-- shared, never the safety timer itself.

CREATE TABLE "TourGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizerId" TEXT NOT NULL,
    "routeName" TEXT,
    "activity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TourGroup_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "TourGroupInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TourGroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TourGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TourGroupInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TourGroupInvite_groupId_inviteeId_key" UNIQUE ("groupId", "inviteeId")
);

ALTER TABLE "Tour" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TourGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
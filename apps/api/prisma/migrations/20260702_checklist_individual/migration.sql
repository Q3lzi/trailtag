-- Checklist items can be SHARED (one confirmation covers the group, e.g.
-- first-aid kit) or INDIVIDUAL (each participant needs their own gear,
-- e.g. headlamp/tent — one person checking it off must not read as "done
-- for everyone").
ALTER TABLE "TourGroupChecklistItem" ADD COLUMN IF NOT EXISTS "itemType" TEXT NOT NULL DEFAULT 'SHARED';

CREATE TABLE IF NOT EXISTS "TourGroupChecklistCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TourGroupChecklistCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TourGroupChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TourGroupChecklistCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TourGroupChecklistCheck_itemId_userId_key" UNIQUE ("itemId", "userId")
);

-- Simple shared checklist for shared-hike prep — a memory aid, not an
-- assignment system.
CREATE TABLE IF NOT EXISTS "TourGroupChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TourGroupChecklistItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TourGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TourGroupChecklistItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

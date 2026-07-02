-- Admin role and account-lock flag, independent of each other. isAdmin
-- grants access to the /admin area; isLocked suspends login without
-- deleting the account (for support/moderation cases).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;

/*
  Warnings:

  - Changed the type of `activity` on the `Tour` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('WANDERN', 'BERGTOUR', 'KLETTERN', 'TRAILRUNNING', 'MOUNTAINBIKE', 'RADSPORT', 'SKI_SNOWBOARD', 'SKITOUR', 'KLETTERSTEIG', 'KANU_KAJAK', 'PARAGLIDING', 'ANDERE');

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "difficulty" TEXT,
ADD COLUMN     "lastLat" DOUBLE PRECISION,
ADD COLUMN     "lastLng" DOUBLE PRECISION,
ADD COLUMN     "locationUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "parkingLocation" TEXT,
ADD COLUMN     "persons" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "routeName" TEXT,
ADD COLUMN     "startLat" DOUBLE PRECISION,
ADD COLUMN     "startLng" DOUBLE PRECISION,
DROP COLUMN "activity",
ADD COLUMN     "activity" "ActivityType" NOT NULL;

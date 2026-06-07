-- CreateTable
CREATE TABLE "TourLocation" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "ele" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourLocation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TourLocation" ADD CONSTRAINT "TourLocation_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

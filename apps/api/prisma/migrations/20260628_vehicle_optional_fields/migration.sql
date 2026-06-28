-- Make vehicle make/model/color optional — many Swiss users only know the
-- license plate, and forcing these fields hurt the add-vehicle UX.
ALTER TABLE "Vehicle" ALTER COLUMN "make" DROP NOT NULL;
ALTER TABLE "Vehicle" ALTER COLUMN "model" DROP NOT NULL;
ALTER TABLE "Vehicle" ALTER COLUMN "color" DROP NOT NULL;
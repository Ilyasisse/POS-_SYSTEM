ALTER TABLE "TableCheck"
ADD COLUMN "guestCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "TableCheck"
ADD CONSTRAINT "TableCheck_guestCount_check"
CHECK ("guestCount" BETWEEN 1 AND 100);

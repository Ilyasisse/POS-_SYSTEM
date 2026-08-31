ALTER TABLE "Product"
ADD COLUMN "availabilityStartMinute" INTEGER,
ADD COLUMN "availabilityEndMinute" INTEGER;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_availability_window_check" CHECK (
  (
    "availabilityStartMinute" IS NULL
    AND "availabilityEndMinute" IS NULL
  )
  OR
  (
    "availabilityStartMinute" BETWEEN 0 AND 1439
    AND "availabilityEndMinute" BETWEEN 0 AND 1439
    AND "availabilityStartMinute" <> "availabilityEndMinute"
  )
);

CREATE INDEX "Product_isActive_availabilityStartMinute_availabilityEndMinute_idx"
ON "Product"("isActive", "availabilityStartMinute", "availabilityEndMinute");

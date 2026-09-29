ALTER TABLE "Product"
ADD COLUMN "availableForSale" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "availabilityRestoresAt" TIMESTAMP(3),
ADD COLUMN "availabilityReason" TEXT;

CREATE INDEX "Product_availableForSale_availabilityRestoresAt_idx"
ON "Product"("availableForSale", "availabilityRestoresAt");

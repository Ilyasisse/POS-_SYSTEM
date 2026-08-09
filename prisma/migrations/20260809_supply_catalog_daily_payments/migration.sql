CREATE TABLE "SupplyCatalogItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "defaultUnitPrice" DECIMAL(12,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplyCatalogItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplyCatalogItem_defaultUnitPrice_check" CHECK ("defaultUnitPrice" >= 0)
);

CREATE TABLE "SupplyDay" (
  "id" TEXT NOT NULL,
  "purchaseDate" DATE NOT NULL,
  "closedTotal" DECIMAL(14,2),
  "closedAt" TIMESTAMP(3),
  "closedByUserId" TEXT,
  "reopenedAt" TIMESTAMP(3),
  "reopenedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplyDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplyDay_close_state_check" CHECK (
    ("closedAt" IS NULL AND "closedTotal" IS NULL AND "closedByUserId" IS NULL)
    OR ("closedAt" IS NOT NULL AND "closedTotal" IS NOT NULL AND "closedByUserId" IS NOT NULL AND "closedTotal" > 0)
  )
);

CREATE TABLE "DailyCashSupplyPayment" (
  "id" TEXT NOT NULL,
  "dailyCashDayId" TEXT NOT NULL,
  "supplyDayId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "revenueFunded" DECIMAL(14,2) NOT NULL,
  "savingsFunded" DECIMAL(14,2) NOT NULL,
  "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyCashSupplyPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyCashSupplyPayment_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "DailyCashSupplyPayment_funding_check" CHECK ("revenueFunded" >= 0 AND "savingsFunded" >= 0 AND "revenueFunded" + "savingsFunded" = "amount")
);

INSERT INTO "SupplyDay" ("id", "purchaseDate", "updatedAt")
SELECT 'legacy-' || md5("purchaseDate"::text), "purchaseDate", CURRENT_TIMESTAMP
FROM "SupplyPurchase"
GROUP BY "purchaseDate";

ALTER TABLE "SupplyPurchase"
  ADD COLUMN "catalogItemId" TEXT,
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'unit';

CREATE UNIQUE INDEX "SupplyCatalogItem_name_unit_key" ON "SupplyCatalogItem"("name", "unit");
CREATE INDEX "SupplyCatalogItem_isActive_name_idx" ON "SupplyCatalogItem"("isActive", "name");
CREATE INDEX "SupplyCatalogItem_createdByUserId_createdAt_idx" ON "SupplyCatalogItem"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "SupplyDay_purchaseDate_key" ON "SupplyDay"("purchaseDate");
CREATE INDEX "SupplyDay_closedAt_purchaseDate_idx" ON "SupplyDay"("closedAt", "purchaseDate");
CREATE INDEX "SupplyDay_closedByUserId_idx" ON "SupplyDay"("closedByUserId");
CREATE INDEX "SupplyDay_reopenedByUserId_idx" ON "SupplyDay"("reopenedByUserId");
CREATE INDEX "SupplyPurchase_catalogItemId_idx" ON "SupplyPurchase"("catalogItemId");
CREATE INDEX "DailyCashSupplyPayment_dailyCashDayId_createdAt_idx" ON "DailyCashSupplyPayment"("dailyCashDayId", "createdAt");
CREATE INDEX "DailyCashSupplyPayment_supplyDayId_createdAt_idx" ON "DailyCashSupplyPayment"("supplyDayId", "createdAt");
CREATE INDEX "DailyCashSupplyPayment_recordedByUserId_createdAt_idx" ON "DailyCashSupplyPayment"("recordedByUserId", "createdAt");

ALTER TABLE "SupplyCatalogItem" ADD CONSTRAINT "SupplyCatalogItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyDay" ADD CONSTRAINT "SupplyDay_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyDay" ADD CONSTRAINT "SupplyDay_reopenedByUserId_fkey" FOREIGN KEY ("reopenedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyPurchase" ADD CONSTRAINT "SupplyPurchase_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "SupplyCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplyPurchase" ADD CONSTRAINT "SupplyPurchase_purchaseDate_fkey" FOREIGN KEY ("purchaseDate") REFERENCES "SupplyDay"("purchaseDate") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashSupplyPayment" ADD CONSTRAINT "DailyCashSupplyPayment_dailyCashDayId_fkey" FOREIGN KEY ("dailyCashDayId") REFERENCES "DailyCashDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyCashSupplyPayment" ADD CONSTRAINT "DailyCashSupplyPayment_supplyDayId_fkey" FOREIGN KEY ("supplyDayId") REFERENCES "SupplyDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashSupplyPayment" ADD CONSTRAINT "DailyCashSupplyPayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

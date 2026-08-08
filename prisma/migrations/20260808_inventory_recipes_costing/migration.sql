CREATE TYPE "CanonicalUnit" AS ENUM ('GRAM', 'MILLILITRE', 'PIECE');
CREATE TYPE "InventoryDataCoverage" AS ENUM ('COMPLETE', 'LEGACY_INCOMPLETE', 'MISSING_COST');
CREATE TYPE "StockEventType" AS ENUM ('RECEIPT', 'SALE_USAGE', 'RECIPE_USAGE', 'MANUAL_USAGE', 'WASTE', 'SPOILAGE', 'DAMAGE', 'STAFF_CONSUMPTION', 'COMPLIMENTARY_USAGE', 'COUNT_VARIANCE', 'ADJUSTMENT');
CREATE TYPE "InventoryCountStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

ALTER TABLE "Product"
  ALTER COLUMN "cost" TYPE DECIMAL(14,6) USING "cost"::numeric,
  ALTER COLUMN "stockQty" TYPE DECIMAL(18,6) USING "stockQty"::numeric,
  ALTER COLUMN "lowStockThreshold" TYPE DECIMAL(18,6) USING "lowStockThreshold"::numeric,
  ADD COLUMN "canonicalUnit" "CanonicalUnit" NOT NULL DEFAULT 'PIECE',
  ADD COLUMN "quantityCoverage" "InventoryDataCoverage" NOT NULL DEFAULT 'COMPLETE',
  ADD COLUMN "standardCostUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "standardCostUpdatedByUserId" TEXT;

ALTER TABLE "InventorySupply"
  ALTER COLUMN "stockQty" TYPE DECIMAL(18,6) USING "stockQty"::numeric,
  ALTER COLUMN "lowStockThreshold" TYPE DECIMAL(18,6) USING "lowStockThreshold"::numeric,
  ADD COLUMN "canonicalUnit" "CanonicalUnit",
  ADD COLUMN "quantityCoverage" "InventoryDataCoverage" NOT NULL DEFAULT 'LEGACY_INCOMPLETE',
  ADD COLUMN "standardUnitCost" DECIMAL(14,6),
  ADD COLUMN "standardCostUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "standardCostUpdatedByUserId" TEXT;

UPDATE "InventorySupply"
SET "stockQty" = "stockQty" * CASE
      WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'kilograms') THEN 1000
      WHEN lower(trim("unit")) IN ('l', 'liter', 'liters', 'litre', 'litres') THEN 1000
      ELSE 1
    END,
    "lowStockThreshold" = "lowStockThreshold" * CASE
      WHEN lower(trim("unit")) IN ('kg', 'kilogram', 'kilograms') THEN 1000
      WHEN lower(trim("unit")) IN ('l', 'liter', 'liters', 'litre', 'litres') THEN 1000
      ELSE 1
    END,
    "canonicalUnit" = CASE
      WHEN lower(trim("unit")) IN ('g', 'gm', 'gram', 'grams', 'kg', 'kilogram', 'kilograms') THEN 'GRAM'::"CanonicalUnit"
      WHEN lower(trim("unit")) IN ('ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'l', 'liter', 'liters', 'litre', 'litres') THEN 'MILLILITRE'::"CanonicalUnit"
      WHEN lower(trim("unit")) IN ('piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'each') THEN 'PIECE'::"CanonicalUnit"
      ELSE NULL
    END,
    "quantityCoverage" = CASE
      WHEN lower(trim("unit")) IN ('g', 'gm', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'l', 'liter', 'liters', 'litre', 'litres', 'piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'each') THEN 'COMPLETE'::"InventoryDataCoverage"
      ELSE 'LEGACY_INCOMPLETE'::"InventoryDataCoverage"
    END;

ALTER TABLE "InventoryMovement"
  ALTER COLUMN "delta" TYPE DECIMAL(18,6) USING "delta"::numeric,
  ALTER COLUMN "quantityBefore" TYPE DECIMAL(18,6) USING "quantityBefore"::numeric,
  ALTER COLUMN "quantityAfter" TYPE DECIMAL(18,6) USING "quantityAfter"::numeric,
  ADD COLUMN "canonicalUnit" "CanonicalUnit",
  ADD COLUMN "dataCoverage" "InventoryDataCoverage" NOT NULL DEFAULT 'LEGACY_INCOMPLETE',
  ADD COLUMN "standardUnitCostSnapshot" DECIMAL(14,6);

ALTER TABLE "OrderItem"
  ALTER COLUMN "unitCostSnapshot" TYPE DECIMAL(14,6) USING "unitCostSnapshot"::numeric;

CREATE TABLE "InventoryUnitConversion" (
  "id" TEXT NOT NULL,
  "supplyId" TEXT NOT NULL,
  "purchaseUnit" TEXT NOT NULL,
  "canonicalQuantity" DECIMAL(18,6) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryUnitConversion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryUnitConversion_quantity_positive" CHECK ("canonicalQuantity" > 0)
);

CREATE TABLE "RecipeVersion" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "yieldQuantity" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "standardCost" DECIMAL(14,6),
  "costCoverage" "InventoryDataCoverage" NOT NULL DEFAULT 'MISSING_COST',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecipeVersion_yield_positive" CHECK ("yieldQuantity" > 0),
  CONSTRAINT "RecipeVersion_effective_range" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "RecipeIngredient" (
  "id" TEXT NOT NULL,
  "recipeVersionId" TEXT NOT NULL,
  "supplyId" TEXT NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "standardUnitCostSnapshot" DECIMAL(14,6),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecipeIngredient_quantity_positive" CHECK ("quantity" > 0)
);

CREATE TABLE "StockEvent" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "supplyId" TEXT,
  "type" "StockEventType" NOT NULL,
  "quantityDelta" DECIMAL(18,6) NOT NULL,
  "quantityBefore" DECIMAL(18,6) NOT NULL,
  "quantityAfter" DECIMAL(18,6) NOT NULL,
  "canonicalUnit" "CanonicalUnit" NOT NULL,
  "standardUnitCostSnapshot" DECIMAL(14,6),
  "dataCoverage" "InventoryDataCoverage" NOT NULL DEFAULT 'COMPLETE',
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT,
  "approvedByUserId" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockEvent_single_target" CHECK (("productId" IS NOT NULL)::int + ("supplyId" IS NOT NULL)::int = 1),
  CONSTRAINT "StockEvent_balances" CHECK ("quantityAfter" = "quantityBefore" + "quantityDelta")
);

CREATE TABLE "InventoryCountSession" (
  "id" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "status" "InventoryCountStatus" NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "submittedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCountSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryCountLine" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "productId" TEXT,
  "supplyId" TEXT,
  "canonicalUnit" "CanonicalUnit" NOT NULL,
  "expectedQuantity" DECIMAL(18,6) NOT NULL,
  "physicalQuantity" DECIMAL(18,6) NOT NULL,
  "varianceQuantity" DECIMAL(18,6) NOT NULL,
  "standardUnitCostSnapshot" DECIMAL(14,6),
  "dataCoverage" "InventoryDataCoverage" NOT NULL DEFAULT 'COMPLETE',
  "stockEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryCountLine_single_target" CHECK (("productId" IS NOT NULL)::int + ("supplyId" IS NOT NULL)::int = 1),
  CONSTRAINT "InventoryCountLine_variance" CHECK ("varianceQuantity" = "physicalQuantity" - "expectedQuantity")
);

CREATE UNIQUE INDEX "InventoryUnitConversion_supplyId_purchaseUnit_key" ON "InventoryUnitConversion"("supplyId", "purchaseUnit");
CREATE INDEX "InventoryUnitConversion_supplyId_isActive_idx" ON "InventoryUnitConversion"("supplyId", "isActive");
CREATE UNIQUE INDEX "RecipeVersion_productId_version_key" ON "RecipeVersion"("productId", "version");
CREATE INDEX "RecipeVersion_productId_effectiveFrom_effectiveTo_idx" ON "RecipeVersion"("productId", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "RecipeIngredient_recipeVersionId_supplyId_key" ON "RecipeIngredient"("recipeVersionId", "supplyId");
CREATE INDEX "RecipeIngredient_supplyId_idx" ON "RecipeIngredient"("supplyId");
CREATE INDEX "StockEvent_productId_occurredAt_idx" ON "StockEvent"("productId", "occurredAt");
CREATE INDEX "StockEvent_supplyId_occurredAt_idx" ON "StockEvent"("supplyId", "occurredAt");
CREATE INDEX "StockEvent_type_occurredAt_idx" ON "StockEvent"("type", "occurredAt");
CREATE INDEX "StockEvent_sourceType_sourceId_idx" ON "StockEvent"("sourceType", "sourceId");
CREATE INDEX "InventoryCountSession_businessDate_status_idx" ON "InventoryCountSession"("businessDate", "status");
CREATE UNIQUE INDEX "InventoryCountLine_stockEventId_key" ON "InventoryCountLine"("stockEventId");
CREATE INDEX "InventoryCountLine_sessionId_idx" ON "InventoryCountLine"("sessionId");
CREATE INDEX "InventoryCountLine_productId_idx" ON "InventoryCountLine"("productId");
CREATE INDEX "InventoryCountLine_supplyId_idx" ON "InventoryCountLine"("supplyId");
CREATE UNIQUE INDEX "InventoryCountLine_sessionId_productId_key" ON "InventoryCountLine"("sessionId", "productId");
CREATE UNIQUE INDEX "InventoryCountLine_sessionId_supplyId_key" ON "InventoryCountLine"("sessionId", "supplyId");
CREATE INDEX "Product_standardCostUpdatedByUserId_idx" ON "Product"("standardCostUpdatedByUserId");
CREATE INDEX "InventorySupply_standardCostUpdatedByUserId_idx" ON "InventorySupply"("standardCostUpdatedByUserId");
CREATE INDEX "OrderItem_recipeVersionId_idx" ON "OrderItem"("recipeVersionId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_standardCostUpdatedByUserId_fkey" FOREIGN KEY ("standardCostUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventorySupply" ADD CONSTRAINT "InventorySupply_standardCostUpdatedByUserId_fkey" FOREIGN KEY ("standardCostUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryUnitConversion" ADD CONSTRAINT "InventoryUnitConversion_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "InventorySupply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "InventorySupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockEvent" ADD CONSTRAINT "StockEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEvent" ADD CONSTRAINT "StockEvent_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "InventorySupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEvent" ADD CONSTRAINT "StockEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockEvent" ADD CONSTRAINT "StockEvent_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryCountSession" ADD CONSTRAINT "InventoryCountSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCountSession" ADD CONSTRAINT "InventoryCountSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryCountSession" ADD CONSTRAINT "InventoryCountSession_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InventoryCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "InventorySupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_stockEventId_fkey" FOREIGN KEY ("stockEventId") REFERENCES "StockEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_stock_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'StockEvent records are immutable';
END;
$$;

CREATE TRIGGER "StockEvent_immutable"
BEFORE UPDATE OR DELETE ON "StockEvent"
FOR EACH ROW EXECUTE FUNCTION reject_stock_event_mutation();

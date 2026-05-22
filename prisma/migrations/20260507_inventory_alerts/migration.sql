DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'InventoryAlertStatus'
  ) THEN
    CREATE TYPE "InventoryAlertStatus" AS ENUM ('OK', 'LOW', 'OUT');
  END IF;
END $$;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS "inventoryAlertStatus" "InventoryAlertStatus" NOT NULL DEFAULT 'OK';

CREATE TABLE IF NOT EXISTS "InventorySupply" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'unit',
  "stockQty" INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
  "inventoryAlertStatus" "InventoryAlertStatus" NOT NULL DEFAULT 'OK',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventorySupply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "supplyId" TEXT,
  "itemName" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "quantityBefore" INTEGER NOT NULL,
  "quantityAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventorySupply_name_unit_key'
  ) THEN
    ALTER TABLE "InventorySupply"
    ADD CONSTRAINT "InventorySupply_name_unit_key" UNIQUE ("name", "unit");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryMovement_productId_fkey'
  ) THEN
    ALTER TABLE "InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryMovement_supplyId_fkey'
  ) THEN
    ALTER TABLE "InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_supplyId_fkey"
    FOREIGN KEY ("supplyId") REFERENCES "InventorySupply"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Product_trackStock_inventoryAlertStatus_idx"
ON "Product"("trackStock", "inventoryAlertStatus");

CREATE INDEX IF NOT EXISTS "InventorySupply_isActive_inventoryAlertStatus_idx"
ON "InventorySupply"("isActive", "inventoryAlertStatus");

CREATE INDEX IF NOT EXISTS "InventoryMovement_productId_createdAt_idx"
ON "InventoryMovement"("productId", "createdAt");

CREATE INDEX IF NOT EXISTS "InventoryMovement_supplyId_createdAt_idx"
ON "InventoryMovement"("supplyId", "createdAt");

CREATE INDEX IF NOT EXISTS "InventoryMovement_createdAt_idx"
ON "InventoryMovement"("createdAt");

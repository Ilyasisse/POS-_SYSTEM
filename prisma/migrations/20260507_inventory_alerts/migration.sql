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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Product'
  ) THEN
    ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "trackStock" BOOLEAN NOT NULL DEFAULT false;

    ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "stockQty" INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "inventoryAlertStatus" "InventoryAlertStatus" NOT NULL DEFAULT 'OK';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Product'
  ) THEN
    CREATE INDEX IF NOT EXISTS "Product_trackStock_inventoryAlertStatus_idx"
    ON "Product"("trackStock", "inventoryAlertStatus");
  END IF;
END $$;
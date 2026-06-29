DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'InventoryMovement'
  ) THEN
    ALTER TABLE "InventoryMovement"
    DROP CONSTRAINT IF EXISTS "InventoryMovement_productId_fkey";

    ALTER TABLE "InventoryMovement"
    DROP COLUMN IF EXISTS "productId";
  END IF;
END $$;
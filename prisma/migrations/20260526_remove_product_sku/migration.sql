DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Product'
  ) THEN
    ALTER TABLE "Product"
    DROP COLUMN IF EXISTS "sku";
  END IF;
END $$;
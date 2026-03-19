DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'Station'
      AND enum_value.enumlabel = 'BARISTA'
  ) THEN
    ALTER TYPE "Station" ADD VALUE 'BARISTA';
  END IF;
END $$;

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "waiterId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Order_waiterId_fkey'
  ) THEN
    ALTER TABLE "Order"
    ADD CONSTRAINT "Order_waiterId_fkey"
    FOREIGN KEY ("waiterId") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Order_waiterId_createdAt_idx"
ON "Order"("waiterId", "createdAt");

UPDATE "User"
SET "station" = 'BARISTA'::"Station"
WHERE "role" = 'BARISTA'
  AND ("station" IS NULL OR "station" <> 'BARISTA'::"Station");

UPDATE "Category"
SET "station" = 'BARISTA'::"Station"
WHERE lower("name") IN ('coffee', 'tea', 'coffee/tea');

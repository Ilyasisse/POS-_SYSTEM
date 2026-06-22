DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'SupplierDeliveryStatus'
  ) AND EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = '"SupplierDeliveryStatus"'::regtype
      AND enumlabel = 'PENDING_OCR'
  ) THEN
    ALTER TYPE "SupplierDeliveryStatus" RENAME VALUE 'PENDING_OCR' TO 'PENDING_EXTRACTION';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'SupplierDeliveryStatus'
  ) THEN
    UPDATE "SupplierDelivery"
    SET "status" = 'PENDING_EXTRACTION'
    WHERE "status" = 'PENDING_OCR';

    ALTER TABLE "SupplierDelivery"
    ALTER COLUMN "status" SET DEFAULT 'PENDING_EXTRACTION';
  END IF;
END $$;

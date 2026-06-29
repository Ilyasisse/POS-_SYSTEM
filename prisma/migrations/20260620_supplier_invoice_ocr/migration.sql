ALTER TABLE "SupplierDelivery"
ADD COLUMN IF NOT EXISTS "extractedText" TEXT,
ADD COLUMN IF NOT EXISTS "ocrError" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'SupplierDeliveryStatus'
  ) AND EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = '"SupplierDeliveryStatus"'::regtype
      AND enumlabel = 'PENDING_AI'
  ) THEN
    ALTER TYPE "SupplierDeliveryStatus" RENAME VALUE 'PENDING_AI' TO 'PENDING_OCR';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'SupplierDeliveryStatus'
  ) THEN
    UPDATE "SupplierDelivery"
    SET "status" = 'PENDING_OCR'
    WHERE "status" = 'PENDING_AI';

    ALTER TABLE "SupplierDelivery"
    ALTER COLUMN "status" SET DEFAULT 'PENDING_OCR';
  END IF;
END $$;

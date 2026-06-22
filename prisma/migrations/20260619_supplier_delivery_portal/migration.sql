CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "googleEmail" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_email_key"
ON "Supplier"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_googleEmail_key"
ON "Supplier"("googleEmail");

CREATE TABLE IF NOT EXISTS "SupplierDelivery" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "receivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplierDelivery_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Supplier'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'SupplierDelivery'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SupplierDelivery_supplierId_fkey'
  ) THEN
    ALTER TABLE "SupplierDelivery"
    ADD CONSTRAINT "SupplierDelivery_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'User'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'SupplierDelivery'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SupplierDelivery_receivedById_fkey'
  ) THEN
    ALTER TABLE "SupplierDelivery"
    ADD CONSTRAINT "SupplierDelivery_receivedById_fkey"
    FOREIGN KEY ("receivedById") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SupplierDelivery_supplierId_createdAt_idx"
ON "SupplierDelivery"("supplierId", "createdAt");

CREATE INDEX IF NOT EXISTS "SupplierDelivery_status_createdAt_idx"
ON "SupplierDelivery"("status", "createdAt");
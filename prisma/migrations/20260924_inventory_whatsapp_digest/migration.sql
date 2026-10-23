CREATE TABLE "InventoryWhatsAppDigest" (
    "digestDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "messageSid" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryWhatsAppDigest_pkey" PRIMARY KEY ("digestDate"),
    CONSTRAINT "InventoryWhatsAppDigest_status_check" CHECK ("status" IN ('PENDING', 'SENT', 'FAILED'))
);

-- Internal cron data is never readable through the Supabase Data API.
ALTER TABLE "InventoryWhatsAppDigest" ENABLE ROW LEVEL SECURITY;

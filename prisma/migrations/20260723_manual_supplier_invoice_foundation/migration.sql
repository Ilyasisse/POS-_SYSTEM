CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOID');
CREATE TYPE "SupplierInvoiceSource" AS ENUM ('PURCHASE_ORDER', 'LEGACY_UPLOAD');

CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "source" "SupplierInvoiceSource" NOT NULL,
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceNumber" TEXT,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "notes" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "receiptObjectPath" TEXT,
    "receiptContentType" TEXT,
    "uploadedByEmail" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacyInventoryUpdatedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierInvoice_totalAmount_check" CHECK ("totalAmount" >= 0),
    CONSTRAINT "SupplierInvoice_invoiceNumber_check"
      CHECK ("invoiceNumber" IS NULL OR char_length(btrim("invoiceNumber")) BETWEEN 1 AND 200),
    CONSTRAINT "SupplierInvoice_notes_check"
      CHECK ("notes" IS NULL OR char_length("notes") <= 2000),
    CONSTRAINT "SupplierInvoice_receipt_pair_check"
      CHECK (("receiptObjectPath" IS NULL) = ("receiptContentType" IS NULL))
);

CREATE TABLE "SupplierInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "supplierCatalogItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "itemUnit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoiceItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierInvoiceItem_name_check"
      CHECK (char_length(btrim("itemName")) BETWEEN 1 AND 300),
    CONSTRAINT "SupplierInvoiceItem_unit_check"
      CHECK (char_length(btrim("itemUnit")) BETWEEN 1 AND 40),
    CONSTRAINT "SupplierInvoiceItem_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "SupplierInvoiceItem_unitPrice_check" CHECK ("unitPrice" >= 0),
    CONSTRAINT "SupplierInvoiceItem_lineTotal_check" CHECK ("lineTotal" >= 0),
    CONSTRAINT "SupplierInvoiceItem_notes_check"
      CHECK ("notes" IS NULL OR char_length("notes") <= 1000)
);

ALTER TABLE "SupplierBill"
ALTER COLUMN "deliveryId" DROP NOT NULL,
ADD COLUMN "invoiceId" TEXT;

ALTER TABLE "SupplierBill"
ADD CONSTRAINT "SupplierBill_exactly_one_source_check"
CHECK (("deliveryId" IS NOT NULL)::int + ("invoiceId" IS NOT NULL)::int = 1);

CREATE UNIQUE INDEX "SupplierBill_invoiceId_key"
ON "SupplierBill"("invoiceId");

CREATE INDEX "SupplierInvoice_supplierId_status_dueDate_idx"
ON "SupplierInvoice"("supplierId", "status", "dueDate");

CREATE INDEX "SupplierInvoice_purchaseOrderId_status_idx"
ON "SupplierInvoice"("purchaseOrderId", "status");

CREATE INDEX "SupplierInvoice_source_status_createdAt_idx"
ON "SupplierInvoice"("source", "status", "createdAt");

CREATE INDEX "SupplierInvoice_createdByUserId_createdAt_idx"
ON "SupplierInvoice"("createdByUserId", "createdAt");

CREATE UNIQUE INDEX "SupplierInvoice_one_active_per_purchase_order_key"
ON "SupplierInvoice"("purchaseOrderId")
WHERE "purchaseOrderId" IS NOT NULL AND "status" IN ('DRAFT', 'FINALIZED');

CREATE UNIQUE INDEX "SupplierInvoiceItem_invoiceId_supplierCatalogItemId_key"
ON "SupplierInvoiceItem"("invoiceId", "supplierCatalogItemId");

CREATE INDEX "SupplierInvoiceItem_supplierCatalogItemId_idx"
ON "SupplierInvoiceItem"("supplierCatalogItemId");

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "SupplierPurchaseOrder"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_finalizedByUserId_fkey"
FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_voidedByUserId_fkey"
FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoiceItem"
ADD CONSTRAINT "SupplierInvoiceItem_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoiceItem"
ADD CONSTRAINT "SupplierInvoiceItem_supplierCatalogItemId_fkey"
FOREIGN KEY ("supplierCatalogItemId") REFERENCES "SupplierCatalogItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierBill"
ADD CONSTRAINT "SupplierBill_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

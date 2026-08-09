ALTER TYPE "SupplierInvoiceSource" ADD VALUE 'RECURRING';

CREATE TYPE "SupplierInvoiceRecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

ALTER TABLE "SupplierInvoice"
ADD COLUMN "recurrenceScheduleId" TEXT,
ADD COLUMN "recurrenceScheduledFor" DATE;

CREATE TABLE "SupplierInvoiceRecurrence" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "sourceInvoiceId" TEXT NOT NULL,
    "unit" "SupplierInvoiceRecurrenceUnit" NOT NULL,
    "interval" INTEGER NOT NULL,
    "nextRunDate" DATE NOT NULL,
    "anchorDay" INTEGER,
    "dueOffsetDays" INTEGER NOT NULL,
    "invoiceNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "pausedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoiceRecurrence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierInvoiceRecurrenceItem" (
    "id" TEXT NOT NULL,
    "recurrenceId" TEXT NOT NULL,
    "supplierCatalogItemId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoiceRecurrenceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierInvoiceRecurrence_sourceInvoiceId_key"
ON "SupplierInvoiceRecurrence"("sourceInvoiceId");
CREATE INDEX "SupplierInvoiceRecurrence_isActive_nextRunDate_idx"
ON "SupplierInvoiceRecurrence"("isActive", "nextRunDate");
CREATE INDEX "SupplierInvoiceRecurrence_supplierId_isActive_idx"
ON "SupplierInvoiceRecurrence"("supplierId", "isActive");
CREATE INDEX "SupplierInvoiceRecurrence_createdByUserId_createdAt_idx"
ON "SupplierInvoiceRecurrence"("createdByUserId", "createdAt");

CREATE UNIQUE INDEX "SupplierInvoiceRecurrenceItem_recurrence_catalog_key"
ON "SupplierInvoiceRecurrenceItem"("recurrenceId", "supplierCatalogItemId");
CREATE UNIQUE INDEX "SupplierInvoiceRecurrenceItem_recurrence_sequence_key"
ON "SupplierInvoiceRecurrenceItem"("recurrenceId", "sequence");
CREATE INDEX "SupplierInvoiceRecurrenceItem_supplierCatalogItemId_idx"
ON "SupplierInvoiceRecurrenceItem"("supplierCatalogItemId");

CREATE UNIQUE INDEX "SupplierInvoice_recurrenceScheduleId_recurrenceScheduledFor_key"
ON "SupplierInvoice"("recurrenceScheduleId", "recurrenceScheduledFor");
CREATE INDEX "SupplierInvoice_recurrenceScheduleId_status_idx"
ON "SupplierInvoice"("recurrenceScheduleId", "status");

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_recurrenceScheduleId_fkey"
FOREIGN KEY ("recurrenceScheduleId") REFERENCES "SupplierInvoiceRecurrence"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoiceRecurrence"
ADD CONSTRAINT "SupplierInvoiceRecurrence_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceRecurrence"
ADD CONSTRAINT "SupplierInvoiceRecurrence_sourceInvoiceId_fkey"
FOREIGN KEY ("sourceInvoiceId") REFERENCES "SupplierInvoice"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceRecurrence"
ADD CONSTRAINT "SupplierInvoiceRecurrence_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceRecurrence"
ADD CONSTRAINT "SupplierInvoiceRecurrence_pausedByUserId_fkey"
FOREIGN KEY ("pausedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoiceRecurrenceItem"
ADD CONSTRAINT "SupplierInvoiceRecurrenceItem_recurrenceId_fkey"
FOREIGN KEY ("recurrenceId") REFERENCES "SupplierInvoiceRecurrence"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceRecurrenceItem"
ADD CONSTRAINT "SupplierInvoiceRecurrenceItem_catalogItemId_fkey"
FOREIGN KEY ("supplierCatalogItemId") REFERENCES "SupplierCatalogItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

BEGIN;

ALTER TABLE "SupplierInvoice"
RENAME COLUMN "invoiceNumber" TO "supplierReference";

ALTER TABLE "SupplierInvoice"
RENAME CONSTRAINT "SupplierInvoice_invoiceNumber_check"
TO "SupplierInvoice_supplierReference_check";

CREATE SEQUENCE "SupplierInvoice_invoiceNumber_seq";

ALTER TABLE "SupplierInvoice"
ADD COLUMN "invoiceNumber" INTEGER;

WITH numbered_invoices AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC)::INTEGER AS "invoiceNumber"
  FROM "SupplierInvoice"
)
UPDATE "SupplierInvoice" AS invoice
SET "invoiceNumber" = numbered_invoices."invoiceNumber"
FROM numbered_invoices
WHERE invoice."id" = numbered_invoices."id";

SELECT setval(
  '"SupplierInvoice_invoiceNumber_seq"',
  COALESCE(MAX("invoiceNumber"), 1),
  COUNT(*) > 0
)
FROM "SupplierInvoice";

ALTER SEQUENCE "SupplierInvoice_invoiceNumber_seq"
OWNED BY "SupplierInvoice"."invoiceNumber";

ALTER TABLE "SupplierInvoice"
ALTER COLUMN "invoiceNumber" SET DEFAULT nextval('"SupplierInvoice_invoiceNumber_seq"'),
ALTER COLUMN "invoiceNumber" SET NOT NULL;

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_invoiceNumber_check"
CHECK ("invoiceNumber" > 0);

CREATE UNIQUE INDEX "SupplierInvoice_invoiceNumber_key"
ON "SupplierInvoice"("invoiceNumber");

COMMIT;

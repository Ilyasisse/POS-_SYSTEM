ALTER TABLE "SupplierPayment" ADD COLUMN "supplierId" TEXT;

UPDATE "SupplierPayment" AS payment
SET "supplierId" = bill."supplierId"
FROM "SupplierBill" AS bill
WHERE payment."billId" = bill."id";

ALTER TABLE "SupplierPayment" ALTER COLUMN "supplierId" SET NOT NULL;

CREATE TABLE "SupplierPaymentAllocation" (
  "id" TEXT NOT NULL,
  "supplierPaymentId" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "installmentId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "appliedByUserId" TEXT NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierPaymentAllocation_amount_check" CHECK ("amount" > 0)
);

INSERT INTO "SupplierPaymentAllocation" (
  "id", "supplierPaymentId", "billId", "installmentId", "amount",
  "appliedByUserId", "allocatedAt", "createdAt"
)
SELECT
  CONCAT('legacy_', payment."id"), payment."id", payment."billId",
  payment."installmentId", payment."amount", payment."recordedByUserId",
  payment."paidAt", payment."createdAt"
FROM "SupplierPayment" AS payment;

CREATE INDEX "SupplierPaymentAllocation_supplierPaymentId_idx"
  ON "SupplierPaymentAllocation"("supplierPaymentId");
CREATE INDEX "SupplierPaymentAllocation_billId_allocatedAt_idx"
  ON "SupplierPaymentAllocation"("billId", "allocatedAt");
CREATE INDEX "SupplierPaymentAllocation_installmentId_idx"
  ON "SupplierPaymentAllocation"("installmentId");
CREATE INDEX "SupplierPaymentAllocation_appliedByUserId_allocatedAt_idx"
  ON "SupplierPaymentAllocation"("appliedByUserId", "allocatedAt");

ALTER TABLE "SupplierPaymentAllocation"
  ADD CONSTRAINT "SupplierPaymentAllocation_supplierPaymentId_fkey"
  FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentAllocation"
  ADD CONSTRAINT "SupplierPaymentAllocation_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentAllocation"
  ADD CONSTRAINT "SupplierPaymentAllocation_installmentId_fkey"
  FOREIGN KEY ("installmentId") REFERENCES "SupplierInvoiceInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentAllocation"
  ADD CONSTRAINT "SupplierPaymentAllocation_appliedByUserId_fkey"
  FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayment"
  ADD CONSTRAINT "SupplierPayment_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "SupplierPayment_billId_paidAt_idx";
DROP INDEX IF EXISTS "SupplierPayment_installmentId_idx";
ALTER TABLE "SupplierPayment" DROP CONSTRAINT IF EXISTS "SupplierPayment_billId_fkey";
ALTER TABLE "SupplierPayment" DROP CONSTRAINT IF EXISTS "SupplierPayment_installmentId_fkey";
ALTER TABLE "SupplierPayment" DROP COLUMN "billId";
ALTER TABLE "SupplierPayment" DROP COLUMN "installmentId";

ALTER TABLE "SupplierPayment"
  ADD CONSTRAINT "SupplierPayment_amount_check" CHECK ("amount" > 0);

CREATE INDEX "SupplierPayment_supplierId_paidAt_idx"
  ON "SupplierPayment"("supplierId", "paidAt");

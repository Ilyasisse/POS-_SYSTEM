-- Existing supplier bills stay in legacy single-due-date mode until a user
-- explicitly creates installment rows for them.
CREATE TABLE "SupplierInvoiceInstallment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "billId" TEXT,
  "sequence" INTEGER NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "SupplierPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "dueDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierInvoiceInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierInvoiceInstallment_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "SupplierInvoiceInstallment_paidAmount_check"
    CHECK ("paidAmount" >= 0 AND "paidAmount" <= "amount")
);

ALTER TABLE "SupplierPayment" ADD COLUMN "installmentId" TEXT;

CREATE UNIQUE INDEX "SupplierInvoiceInstallment_invoiceId_sequence_key"
  ON "SupplierInvoiceInstallment"("invoiceId", "sequence");
CREATE INDEX "SupplierInvoiceInstallment_invoiceId_dueDate_idx"
  ON "SupplierInvoiceInstallment"("invoiceId", "dueDate");
CREATE INDEX "SupplierInvoiceInstallment_billId_status_dueDate_idx"
  ON "SupplierInvoiceInstallment"("billId", "status", "dueDate");
CREATE INDEX "SupplierPayment_installmentId_idx" ON "SupplierPayment"("installmentId");

ALTER TABLE "SupplierInvoiceInstallment"
  ADD CONSTRAINT "SupplierInvoiceInstallment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceInstallment"
  ADD CONSTRAINT "SupplierInvoiceInstallment_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPayment"
  ADD CONSTRAINT "SupplierPayment_installmentId_fkey"
  FOREIGN KEY ("installmentId") REFERENCES "SupplierInvoiceInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "CustomerCheckoutStatus" AS ENUM ('PENDING', 'REVIEW', 'PAYMENT_RECEIVED', 'PAID', 'EXPIRED', 'NEEDS_HELP');

CREATE TABLE "CustomerCheckout" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "payerPhone" TEXT NOT NULL,
  "notes" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "CustomerCheckoutStatus" NOT NULL DEFAULT 'PENDING',
  "receiptId" TEXT,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "CustomerCheckout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerCheckout_idempotencyKey_key" ON "CustomerCheckout"("idempotencyKey");
CREATE UNIQUE INDEX "CustomerCheckout_receiptId_key" ON "CustomerCheckout"("receiptId");
CREATE UNIQUE INDEX "CustomerCheckout_orderId_key" ON "CustomerCheckout"("orderId");
CREATE INDEX "CustomerCheckout_customerId_createdAt_idx" ON "CustomerCheckout"("customerId", "createdAt");
CREATE INDEX "CustomerCheckout_status_amount_expiresAt_idx" ON "CustomerCheckout"("status", "amount", "expiresAt");
CREATE INDEX "CustomerCheckout_payerPhone_status_amount_idx" ON "CustomerCheckout"("payerPhone", "status", "amount");

ALTER TABLE "CustomerCheckout" ADD CONSTRAINT "CustomerCheckout_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerCheckout" ADD CONSTRAINT "CustomerCheckout_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MobileMoneyReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerCheckout" ADD CONSTRAINT "CustomerCheckout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ALTER COLUMN "cashierId" DROP NOT NULL;

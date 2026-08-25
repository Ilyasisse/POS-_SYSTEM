CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'MATCHED', 'CANCELLED', 'EXPIRED');

ALTER TABLE "Payment"
  ADD COLUMN "payerName" TEXT,
  ADD COLUMN "payerPhone" TEXT,
  ADD COLUMN "paymentRequestId" TEXT;

CREATE TABLE "PaymentRequest" (
  "id" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL,
  "lineIndex" INTEGER NOT NULL,
  "tableId" TEXT NOT NULL,
  "cashierId" TEXT NOT NULL,
  "cashierName" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "payerName" TEXT NOT NULL,
  "payerPhone" TEXT NOT NULL,
  "expectedAmount" DECIMAL(65,30) NOT NULL,
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "providerReference" TEXT,
  "rawMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "matchedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentDeferral" (
  "id" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "cashierId" TEXT NOT NULL,
  "cashierName" TEXT NOT NULL,
  "amountDue" DECIMAL(65,30) NOT NULL,
  "amountPaid" DECIMAL(65,30) NOT NULL,
  "remainingAmount" DECIMAL(65,30) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentDeferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRequest_batchKey_lineIndex_key" ON "PaymentRequest"("batchKey", "lineIndex");
CREATE UNIQUE INDEX "PaymentRequest_method_providerReference_key" ON "PaymentRequest"("method", "providerReference");
CREATE INDEX "PaymentRequest_tableId_status_createdAt_idx" ON "PaymentRequest"("tableId", "status", "createdAt");
CREATE INDEX "PaymentRequest_cashierId_createdAt_idx" ON "PaymentRequest"("cashierId", "createdAt");
CREATE UNIQUE INDEX "PaymentDeferral_batchKey_key" ON "PaymentDeferral"("batchKey");
CREATE INDEX "PaymentDeferral_resolvedAt_createdAt_idx" ON "PaymentDeferral"("resolvedAt", "createdAt");
CREATE INDEX "PaymentDeferral_tableId_resolvedAt_idx" ON "PaymentDeferral"("tableId", "resolvedAt");
CREATE INDEX "Payment_paymentRequestId_idx" ON "Payment"("paymentRequestId");

ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentDeferral" ADD CONSTRAINT "PaymentDeferral_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentDeferral" ADD CONSTRAINT "PaymentDeferral_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

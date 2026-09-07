ALTER TYPE "PaymentRequestStatus"
  ADD VALUE IF NOT EXISTS 'PARTIALLY_MATCHED' BEFORE 'MATCHED';

CREATE TYPE "MobileMoneyDirection" AS ENUM (
  'INCOMING',
  'OUTGOING',
  'UNKNOWN'
);

CREATE TYPE "MobileMoneyReceiptStatus" AS ENUM (
  'AVAILABLE',
  'ASSIGNED',
  'OUTGOING',
  'NEEDS_REVIEW'
);

ALTER TABLE "Payment"
  ADD COLUMN "mobileMoneyReceiptId" TEXT;

CREATE TABLE "MobileMoneyReceipt" (
  "id" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "providerLabel" TEXT,
  "method" "PaymentMethod" NOT NULL DEFAULT 'GOLIS',
  "providerReference" TEXT,
  "direction" "MobileMoneyDirection" NOT NULL,
  "status" "MobileMoneyReceiptStatus" NOT NULL,
  "amount" DECIMAL(14,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "counterpartyLabel" TEXT,
  "counterpartyIdentifiers" JSONB,
  "transactionAt" TIMESTAMP(3),
  "providerBalance" DECIMAL(14,2),
  "rawMessage" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "parseError" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedPaymentRequestId" TEXT,
  "assignedByUserId" TEXT,
  "assignedByName" TEXT,
  "assignedAt" TIMESTAMP(3),
  CONSTRAINT "MobileMoneyReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MobileMoneyReceipt_amount_check"
    CHECK ("amount" IS NULL OR "amount" > 0),
  CONSTRAINT "MobileMoneyReceipt_balance_check"
    CHECK ("providerBalance" IS NULL OR "providerBalance" >= 0),
  CONSTRAINT "MobileMoneyReceipt_assignment_check"
    CHECK (
      (
        "status" = 'ASSIGNED'
        AND "assignedPaymentRequestId" IS NOT NULL
        AND "assignedByUserId" IS NOT NULL
        AND "assignedAt" IS NOT NULL
      )
      OR
      (
        "status" <> 'ASSIGNED'
        AND "assignedPaymentRequestId" IS NULL
        AND "assignedByUserId" IS NULL
        AND "assignedAt" IS NULL
      )
    )
);

CREATE TABLE "PaymentGatewayStatus" (
  "id" TEXT NOT NULL DEFAULT 'macrodroid-898',
  "sender" TEXT NOT NULL,
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
  "lastReceiptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentGatewayStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileMoneyReceipt_fingerprint_key"
  ON "MobileMoneyReceipt"("fingerprint");
CREATE UNIQUE INDEX "MobileMoneyReceipt_method_providerReference_key"
  ON "MobileMoneyReceipt"("method", "providerReference");
CREATE INDEX "MobileMoneyReceipt_status_direction_transactionAt_idx"
  ON "MobileMoneyReceipt"("status", "direction", "transactionAt");
CREATE INDEX "MobileMoneyReceipt_assignedPaymentRequestId_idx"
  ON "MobileMoneyReceipt"("assignedPaymentRequestId");
CREATE INDEX "MobileMoneyReceipt_assignedByUserId_assignedAt_idx"
  ON "MobileMoneyReceipt"("assignedByUserId", "assignedAt");
CREATE INDEX "MobileMoneyReceipt_receivedAt_idx"
  ON "MobileMoneyReceipt"("receivedAt");
CREATE INDEX "PaymentGatewayStatus_lastHeartbeatAt_idx"
  ON "PaymentGatewayStatus"("lastHeartbeatAt");
CREATE INDEX "Payment_mobileMoneyReceiptId_idx"
  ON "Payment"("mobileMoneyReceiptId");

ALTER TABLE "MobileMoneyReceipt"
  ADD CONSTRAINT "MobileMoneyReceipt_assignedPaymentRequestId_fkey"
  FOREIGN KEY ("assignedPaymentRequestId")
  REFERENCES "PaymentRequest"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobileMoneyReceipt"
  ADD CONSTRAINT "MobileMoneyReceipt_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_mobileMoneyReceiptId_fkey"
  FOREIGN KEY ("mobileMoneyReceiptId")
  REFERENCES "MobileMoneyReceipt"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MobileMoneyReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentGatewayStatus" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "MobileMoneyReceipt" FROM anon;
    REVOKE ALL ON TABLE "PaymentGatewayStatus" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "MobileMoneyReceipt" FROM authenticated;
    REVOKE ALL ON TABLE "PaymentGatewayStatus" FROM authenticated;
  END IF;
END
$$;

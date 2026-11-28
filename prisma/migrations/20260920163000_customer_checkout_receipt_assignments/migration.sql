ALTER TABLE "MobileMoneyReceipt"
  DROP CONSTRAINT "MobileMoneyReceipt_assignment_check";

ALTER TABLE "MobileMoneyReceipt"
  ADD CONSTRAINT "MobileMoneyReceipt_assignment_check"
  CHECK (
    (
      "status" = 'ASSIGNED'
      AND "assignedAt" IS NOT NULL
      AND (
        (
          "assignedPaymentRequestId" IS NOT NULL
          AND "assignedByUserId" IS NOT NULL
        )
        OR "assignedPaymentRequestId" IS NULL
      )
    )
    OR
    (
      "status" <> 'ASSIGNED'
      AND "assignedPaymentRequestId" IS NULL
      AND "assignedByUserId" IS NULL
      AND "assignedAt" IS NULL
    )
  );

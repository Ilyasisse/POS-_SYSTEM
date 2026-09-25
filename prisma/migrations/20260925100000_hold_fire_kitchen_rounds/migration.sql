ALTER TABLE "KitchenTicketState"
  ADD COLUMN "isHeld" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "courseLabel" TEXT,
  ADD COLUMN "firedAt" TIMESTAMP(3);

CREATE INDEX "KitchenTicketState_isHeld_pickupStatus_updatedAt_idx"
  ON "KitchenTicketState"("isHeld", "pickupStatus", "updatedAt");

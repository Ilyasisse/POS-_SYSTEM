-- Preserve entry timestamps while recording the date inventory actually moved.
ALTER TABLE public."InventoryMovement" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);
UPDATE public."InventoryMovement" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;
ALTER TABLE public."InventoryMovement" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public."InventoryMovement" ALTER COLUMN "occurredAt" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "InventoryMovement_occurredAt_idx" ON public."InventoryMovement"("occurredAt");
CREATE INDEX IF NOT EXISTS "InventoryMovement_supplyId_occurredAt_idx" ON public."InventoryMovement"("supplyId", "occurredAt");

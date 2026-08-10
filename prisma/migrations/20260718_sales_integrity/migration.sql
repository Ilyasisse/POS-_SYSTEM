CREATE TYPE "CostSnapshotSource" AS ENUM ('PRODUCT_STANDARD', 'RECIPE_STANDARD');
CREATE TYPE "SalesAdjustmentType" AS ENUM ('DISCOUNT', 'REFUND', 'VOID', 'COMPLIMENTARY', 'STAFF_MEAL');

ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;
ALTER TABLE "OrderItem"
ADD COLUMN "unitCostSnapshot" DECIMAL(65,30),
ADD COLUMN "costSnapshotSource" "CostSnapshotSource",
ADD COLUMN "recipeVersionId" TEXT;

CREATE TABLE "SalesAdjustment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "type" "SalesAdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "quantity" DECIMAL(12,3),
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SalesAdjustment_amount_nonnegative" CHECK ("amount" >= 0),
    CONSTRAINT "SalesAdjustment_quantity_positive" CHECK ("quantity" IS NULL OR "quantity" > 0)
);

CREATE INDEX "Order_customerId_closedAt_idx" ON "Order"("customerId", "closedAt");
CREATE INDEX "Order_status_closedAt_idx" ON "Order"("status", "closedAt");
CREATE INDEX "SalesAdjustment_orderId_createdAt_idx" ON "SalesAdjustment"("orderId", "createdAt");
CREATE INDEX "SalesAdjustment_orderItemId_createdAt_idx" ON "SalesAdjustment"("orderItemId", "createdAt");
CREATE INDEX "SalesAdjustment_type_createdAt_idx" ON "SalesAdjustment"("type", "createdAt");
CREATE INDEX "SalesAdjustment_actorUserId_createdAt_idx" ON "SalesAdjustment"("actorUserId", "createdAt");
CREATE INDEX "SalesAdjustment_approvedByUserId_createdAt_idx" ON "SalesAdjustment"("approvedByUserId", "createdAt");

ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesAdjustment" ADD CONSTRAINT "SalesAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAdjustment" ADD CONSTRAINT "SalesAdjustment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAdjustment" ADD CONSTRAINT "SalesAdjustment_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAdjustment" ADD CONSTRAINT "SalesAdjustment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_sales_adjustment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SalesAdjustment records are immutable';
END;
$$;

CREATE TRIGGER "SalesAdjustment_immutable"
BEFORE UPDATE OR DELETE ON "SalesAdjustment"
FOR EACH ROW EXECUTE FUNCTION reject_sales_adjustment_mutation();

-- Test-only DDL for invariants absent from schema.prisma.
-- Receipt assignment: 20260920163000_customer_checkout_receipt_assignments.
ALTER TABLE "MobileMoneyReceipt" ADD CONSTRAINT "MobileMoneyReceipt_assignment_check"
CHECK (
  ("status" = 'ASSIGNED' AND "assignedAt" IS NOT NULL AND
    ("assignedPaymentRequestId" IS NULL OR "assignedByUserId" IS NOT NULL))
  OR
  ("status" <> 'ASSIGNED' AND "assignedPaymentRequestId" IS NULL AND
    "assignedByUserId" IS NULL AND "assignedAt" IS NULL)
);

-- Stock and actor invariants: 20260808_inventory_recipes_costing and
-- 20260916213000_separate_staff_customers.
ALTER TABLE "StockEvent"
  ADD CONSTRAINT "StockEvent_single_target"
    CHECK (("productId" IS NOT NULL)::int + ("supplyId" IS NOT NULL)::int = 1),
  ADD CONSTRAINT "StockEvent_balances"
    CHECK ("quantityAfter" = "quantityBefore" + "quantityDelta"),
  ADD CONSTRAINT "StockEvent_single_actor"
    CHECK ("actorUserId" IS NULL OR "actorCustomerId" IS NULL);

ALTER TABLE "KitchenTransitionEvent" ADD CONSTRAINT "KitchenTransitionEvent_single_actor"
  CHECK ("actorUserId" IS NULL OR "actorCustomerId" IS NULL);

-- Append-only history: 20260718_sales_integrity, 20260808_inventory_recipes_costing,
-- and 20260809_kitchen_operations.
CREATE FUNCTION reject_workflow_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% history is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "StockEvent_immutable" BEFORE UPDATE OR DELETE ON "StockEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_workflow_event_mutation();
CREATE TRIGGER "SalesAdjustment_immutable" BEFORE UPDATE OR DELETE ON "SalesAdjustment"
  FOR EACH ROW EXECUTE FUNCTION reject_workflow_event_mutation();
CREATE TRIGGER "KitchenTransitionEvent_immutable" BEFORE UPDATE OR DELETE ON "KitchenTransitionEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_workflow_event_mutation();
CREATE TRIGGER "KitchenQualityEvent_immutable" BEFORE UPDATE OR DELETE ON "KitchenQualityEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_workflow_event_mutation();

-- 20260723_manual_supplier_invoice_foundation.
CREATE UNIQUE INDEX "SupplierInvoice_one_active_per_purchase_order_key"
  ON "SupplierInvoice" ("purchaseOrderId")
  WHERE "purchaseOrderId" IS NOT NULL AND "status" IN ('DRAFT', 'FINALIZED');

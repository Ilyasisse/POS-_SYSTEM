import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "../../src/lib/auth/permissions";
import {
  adjustmentReducesAmountDue,
  isAdjustmentAllowedForStatus,
  requiredAdjustmentPermission,
  snapshotProductCost,
} from "../../src/lib/sales/adjustment-rules";

test("requires financial approval for refunds", () => {
  assert.equal(
    requiredAdjustmentPermission("REFUND"),
    PERMISSIONS.ADJUSTMENT_FINANCIAL_APPROVE,
  );
  for (const type of ["DISCOUNT", "VOID", "COMPLIMENTARY", "STAFF_MEAL"] as const) {
    assert.equal(
      requiredAdjustmentPermission(type),
      PERMISSIONS.ADJUSTMENT_OPERATIONAL_APPROVE,
    );
  }
});

test("allows refunds only on paid orders and operational adjustments only on open orders", () => {
  assert.equal(isAdjustmentAllowedForStatus("REFUND", "PAID"), true);
  assert.equal(isAdjustmentAllowedForStatus("REFUND", "OPEN"), false);
  assert.equal(isAdjustmentAllowedForStatus("VOID", "OPEN"), true);
  assert.equal(isAdjustmentAllowedForStatus("VOID", "PAID"), false);
  assert.equal(isAdjustmentAllowedForStatus("DISCOUNT", "CANCELLED"), false);
});

test("identifies adjustments that reduce the amount due", () => {
  assert.equal(adjustmentReducesAmountDue("DISCOUNT"), true);
  assert.equal(adjustmentReducesAmountDue("COMPLIMENTARY"), true);
  assert.equal(adjustmentReducesAmountDue("STAFF_MEAL"), true);
  assert.equal(adjustmentReducesAmountDue("REFUND"), false);
  assert.equal(adjustmentReducesAmountDue("VOID"), false);
});

test("snapshots known standard cost and preserves unavailable historical cost", () => {
  const covered = snapshotProductCost(new Prisma.Decimal("1.235"));
  assert.equal(covered.unitCostSnapshot?.toFixed(3), "1.235");
  assert.equal(covered.costSnapshotSource, "PRODUCT_STANDARD");
  assert.deepEqual(snapshotProductCost(null), {
    unitCostSnapshot: null,
    costSnapshotSource: null,
  });
});

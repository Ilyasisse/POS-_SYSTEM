import { expect, test } from "@jest/globals";

import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "../../src/lib/auth/permissions";
import {
  adjustmentReducesAmountDue,
  isAdjustmentAllowedForStatus,
  requiredAdjustmentPermission,
  snapshotProductCost,
} from "../../src/lib/sales/adjustment-rules";

test("requires financial approval for refunds", () => {
  expect(requiredAdjustmentPermission("REFUND")).toBe(PERMISSIONS.ADJUSTMENT_FINANCIAL_APPROVE);
  for (const type of ["DISCOUNT", "VOID", "COMPLIMENTARY", "STAFF_MEAL"] as const) {
    expect(requiredAdjustmentPermission(type)).toBe(PERMISSIONS.ADJUSTMENT_OPERATIONAL_APPROVE);
  }
});

test("allows refunds only on paid orders and operational adjustments only on open orders", () => {
  expect(isAdjustmentAllowedForStatus("REFUND", "PAID")).toBe(true);
  expect(isAdjustmentAllowedForStatus("REFUND", "OPEN")).toBe(false);
  expect(isAdjustmentAllowedForStatus("VOID", "OPEN")).toBe(true);
  expect(isAdjustmentAllowedForStatus("VOID", "PAID")).toBe(false);
  expect(isAdjustmentAllowedForStatus("DISCOUNT", "CANCELLED")).toBe(false);
});

test("identifies adjustments that reduce the amount due", () => {
  expect(adjustmentReducesAmountDue("DISCOUNT")).toBe(true);
  expect(adjustmentReducesAmountDue("COMPLIMENTARY")).toBe(true);
  expect(adjustmentReducesAmountDue("STAFF_MEAL")).toBe(true);
  expect(adjustmentReducesAmountDue("REFUND")).toBe(false);
  expect(adjustmentReducesAmountDue("VOID")).toBe(false);
});

test("snapshots known standard cost and preserves unavailable historical cost", () => {
  const covered = snapshotProductCost(new Prisma.Decimal("1.235"));
  expect(covered.unitCostSnapshot?.toFixed(3)).toBe("1.235");
  expect(covered.costSnapshotSource).toBe("PRODUCT_STANDARD");
  expect(snapshotProductCost(null)).toStrictEqual({
    unitCostSnapshot: null,
    costSnapshotSource: null,
  });
});

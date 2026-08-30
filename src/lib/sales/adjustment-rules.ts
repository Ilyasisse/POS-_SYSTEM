import { Prisma, type OrderStatus, type SalesAdjustmentType } from "@prisma/client";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

export function requiredAdjustmentPermission(
  type: SalesAdjustmentType,
): Permission {
  return type === "REFUND"
    ? PERMISSIONS.ADJUSTMENT_FINANCIAL_APPROVE
    : PERMISSIONS.ADJUSTMENT_OPERATIONAL_APPROVE;
}

export function adjustmentReducesAmountDue(type: SalesAdjustmentType) {
  return (
    type === "DISCOUNT" ||
    type === "COMPLIMENTARY" ||
    type === "STAFF_MEAL"
  );
}

export function isAdjustmentAllowedForStatus(
  type: SalesAdjustmentType,
  status: OrderStatus,
) {
  return type === "REFUND" ? status === "PAID" : status === "OPEN";
}

export function snapshotProductCost(cost: Prisma.Decimal | null) {
  return cost == null
    ? { unitCostSnapshot: null, costSnapshotSource: null }
    : {
        unitCostSnapshot: cost,
        costSnapshotSource: "PRODUCT_STANDARD" as const,
      };
}

import { Prisma } from "@prisma/client";

export type SupplierAllocationTarget = {
  billId: string;
  invoiceId: string;
  installmentId: string | null;
  dueDate: Date;
  sequence: number;
  billCreatedAt: Date;
  remainingAmount: Prisma.Decimal;
};

export type PlannedSupplierAllocation = {
  billId: string;
  invoiceId: string;
  installmentId: string | null;
  amount: Prisma.Decimal;
};

function compareTargets(
  first: SupplierAllocationTarget,
  second: SupplierAllocationTarget,
  preferredBillId: string | null,
  preferredInstallmentId: string | null,
) {
  const rank = (target: SupplierAllocationTarget) => {
    if (
      preferredInstallmentId &&
      target.installmentId === preferredInstallmentId
    ) {
      return 0;
    }
    if (preferredBillId && target.billId === preferredBillId) return 1;
    return 2;
  };
  return (
    rank(first) - rank(second) ||
    first.dueDate.getTime() - second.dueDate.getTime() ||
    first.billCreatedAt.getTime() - second.billCreatedAt.getTime() ||
    first.sequence - second.sequence ||
    first.billId.localeCompare(second.billId) ||
    (first.installmentId ?? "").localeCompare(second.installmentId ?? "")
  );
}

export function planSupplierPaymentAllocations(input: {
  amount: Prisma.Decimal.Value;
  targets: readonly SupplierAllocationTarget[];
  preferredBillId?: string | null;
  preferredInstallmentId?: string | null;
}) {
  const paymentAmount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
  if (paymentAmount.lte(0)) {
    throw new Error("Payment amount must be positive.");
  }
  const preferredBillId = input.preferredBillId?.trim() || null;
  const preferredInstallmentId = input.preferredInstallmentId?.trim() || null;
  const targets = [...input.targets]
    .filter((target) => target.remainingAmount.gt(0))
    .sort((first, second) =>
      compareTargets(
        first,
        second,
        preferredBillId,
        preferredInstallmentId,
      ),
    );

  let unallocatedAmount = paymentAmount;
  const allocations: PlannedSupplierAllocation[] = [];
  for (const target of targets) {
    if (unallocatedAmount.equals(0)) break;
    const amount = Prisma.Decimal.min(
      unallocatedAmount,
      target.remainingAmount,
    );
    allocations.push({
      billId: target.billId,
      invoiceId: target.invoiceId,
      installmentId: target.installmentId,
      amount,
    });
    unallocatedAmount = unallocatedAmount.sub(amount);
  }

  return { paymentAmount, allocations, unallocatedAmount };
}

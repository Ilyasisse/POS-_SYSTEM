import { Prisma, type SupplierPaymentStatus } from "@prisma/client";

type MoneyValue = { toString(): string };

export type SupplierPaymentStateInput = {
  totalAmount: MoneyValue;
  dueDate: Date;
  allocations: readonly {
    amount: MoneyValue;
    installmentId: string | null;
    allocatedAt: Date;
    appliedByUserId: string;
  }[];
  installments: readonly {
    id: string;
    amount: MoneyValue;
    dueDate: Date;
  }[];
};

export type SupplierPaymentReversalGuardInput = {
  legacyAllocationAfterSchedule?: boolean;
  dailyCashLinked: boolean;
  dailyCashLocked: boolean;
  canManageDailyCash: boolean;
};

function paymentStatus(
  paidAmount: Prisma.Decimal,
  totalAmount: Prisma.Decimal,
): SupplierPaymentStatus {
  if (paidAmount.equals(0)) return "UNPAID";
  return paidAmount.equals(totalAmount) ? "PAID" : "PARTIAL";
}

export function getSupplierPaymentReversalError(
  input: SupplierPaymentReversalGuardInput,
) {
  if (input.legacyAllocationAfterSchedule) {
    return "This payment cannot be reverted after an installment schedule was created for one of its invoice allocations.";
  }
  if (input.dailyCashLinked && !input.canManageDailyCash) {
    return "Daily Cash permission is required to revert this payment.";
  }
  if (input.dailyCashLinked && input.dailyCashLocked) {
    return "This payment belongs to a permanently locked Daily Cash day and cannot be reverted.";
  }
  return null;
}

export function calculateSupplierPaymentState(
  input: SupplierPaymentStateInput,
) {
  const totalAmount = new Prisma.Decimal(input.totalAmount.toString());
  const paidAmount = input.allocations.reduce(
    (sum, allocation) => sum.add(allocation.amount.toString()),
    new Prisma.Decimal(0),
  );
  if (paidAmount.greaterThan(totalAmount)) {
    throw new Error("Supplier payments exceed the bill total.");
  }

  const status = paymentStatus(paidAmount, totalAmount);
  const latestAllocation = [...input.allocations].sort(
    (first, second) =>
      second.allocatedAt.getTime() - first.allocatedAt.getTime(),
  )[0];
  const installments = input.installments.map((installment) => {
    const installmentAmount = new Prisma.Decimal(installment.amount.toString());
    const installmentPaidAmount = input.allocations.reduce(
      (sum, allocation) =>
        allocation.installmentId === installment.id
          ? sum.add(allocation.amount.toString())
          : sum,
      new Prisma.Decimal(0),
    );
    if (installmentPaidAmount.greaterThan(installmentAmount)) {
      throw new Error("Supplier payments exceed an installment total.");
    }
    return {
      id: installment.id,
      dueDate: installment.dueDate,
      paidAmount: installmentPaidAmount,
      status: paymentStatus(installmentPaidAmount, installmentAmount),
    };
  });
  const nextDueDate = installments
    .filter((installment) => installment.status !== "PAID")
    .sort((first, second) => first.dueDate.getTime() - second.dueDate.getTime())[0]
    ?.dueDate;

  return {
    bill: {
      paidAmount,
      status,
      dueDate: nextDueDate ?? input.dueDate,
      settledAt:
        status === "PAID" ? latestAllocation?.allocatedAt ?? null : null,
      settledByUserId:
        status === "PAID"
          ? latestAllocation?.appliedByUserId ?? null
          : null,
    },
    installments,
  };
}

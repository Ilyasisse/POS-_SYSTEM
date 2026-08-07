import { Prisma, type SupplierPaymentStatus } from "@prisma/client";

type MoneyValue = { toString(): string };

export type SupplierPaymentStateInput = {
  totalAmount: MoneyValue;
  dueDate: Date;
  payments: readonly {
    amount: MoneyValue;
    installmentId: string | null;
    paidAt: Date;
    recordedByUserId: string;
  }[];
  installments: readonly {
    id: string;
    amount: MoneyValue;
    dueDate: Date;
  }[];
};

export type SupplierPaymentReversalGuardInput = {
  installmentId: string | null;
  hasInstallments: boolean;
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
  if (!input.installmentId && input.hasInstallments) {
    return "This legacy payment cannot be reverted after an installment schedule has been created.";
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
  const paidAmount = input.payments.reduce(
    (sum, payment) => sum.add(payment.amount.toString()),
    new Prisma.Decimal(0),
  );
  if (paidAmount.greaterThan(totalAmount)) {
    throw new Error("Supplier payments exceed the bill total.");
  }

  const status = paymentStatus(paidAmount, totalAmount);
  const latestPayment = [...input.payments].sort(
    (first, second) => second.paidAt.getTime() - first.paidAt.getTime(),
  )[0];
  const installments = input.installments.map((installment) => {
    const installmentAmount = new Prisma.Decimal(installment.amount.toString());
    const installmentPaidAmount = input.payments.reduce(
      (sum, payment) =>
        payment.installmentId === installment.id
          ? sum.add(payment.amount.toString())
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
      settledAt: status === "PAID" ? latestPayment?.paidAt ?? null : null,
      settledByUserId:
        status === "PAID" ? latestPayment?.recordedByUserId ?? null : null,
    },
    installments,
  };
}

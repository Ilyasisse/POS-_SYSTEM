import "server-only";

import { Prisma } from "@prisma/client";
import { isDailyCashLocked } from "@/lib/daily-cash/business-date";
import { prisma } from "@/lib/prisma";
import { formatBusinessDateKey } from "@/lib/waiter/waiter-balance-calculations";
import {
  calculateSupplierPaymentState,
  getSupplierPaymentReversalError,
} from "./payment-reversal";
import {
  planSupplierPaymentAllocations,
  type SupplierAllocationTarget,
} from "./payment-allocation";

type Tx = Prisma.TransactionClient;

function positivePaymentAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be positive.");
  }
  const decimal = new Prisma.Decimal(amount);
  if (!decimal.equals(decimal.toDecimalPlaces(2))) {
    throw new Error("Payment amount must have at most two decimal places.");
  }
  return decimal;
}

async function getSupplierAllocationTargets(tx: Tx, supplierId: string) {
  const bills = await tx.supplierBill.findMany({
    where: {
      supplierId,
      status: { in: ["UNPAID", "PARTIAL"] },
      invoice: { status: "FINALIZED" },
    },
    include: {
      installments: {
        orderBy: [{ dueDate: "asc" }, { sequence: "asc" }],
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const targets: SupplierAllocationTarget[] = [];
  for (const bill of bills) {
    if (bill.installments.length) {
      for (const installment of bill.installments) {
        if (installment.status === "PAID") continue;
        targets.push({
          billId: bill.id,
          invoiceId: bill.invoiceId,
          installmentId: installment.id,
          dueDate: installment.dueDate,
          sequence: installment.sequence,
          billCreatedAt: bill.createdAt,
          remainingAmount: installment.amount.sub(installment.paidAmount),
        });
      }
      continue;
    }
    targets.push({
      billId: bill.id,
      invoiceId: bill.invoiceId,
      installmentId: null,
      dueDate: bill.dueDate,
      sequence: 0,
      billCreatedAt: bill.createdAt,
      remainingAmount: bill.totalAmount.sub(bill.paidAmount),
    });
  }
  return targets;
}

async function recalculateSupplierBills(tx: Tx, billIds: readonly string[]) {
  const ids = [...new Set(billIds.filter(Boolean))];
  if (!ids.length) return [];
  const bills = await tx.supplierBill.findMany({
    where: { id: { in: ids } },
    include: {
      allocations: {
        select: {
          amount: true,
          installmentId: true,
          allocatedAt: true,
          appliedByUserId: true,
        },
      },
      installments: {
        orderBy: [{ dueDate: "asc" }, { sequence: "asc" }],
      },
    },
  });
  await Promise.all(
    bills.flatMap((bill) => {
      const nextState = calculateSupplierPaymentState({
        totalAmount: bill.totalAmount,
        dueDate: bill.dueDate,
        allocations: bill.allocations,
        installments: bill.installments,
      });
      return [
        tx.supplierBill.update({
          where: { id: bill.id },
          data: nextState.bill,
        }),
        ...nextState.installments.map((installment) =>
          tx.supplierInvoiceInstallment.update({
            where: { id: installment.id },
            data: {
              paidAmount: installment.paidAmount,
              status: installment.status,
            },
          }),
        ),
      ];
    }),
  );
  return bills.map((bill) => bill.invoiceId);
}

export async function recordSupplierPaymentInTransaction(
  tx: Tx,
  input: {
    supplierId: string;
    recordedByUserId: string;
    amount: number;
    paymentMethod?: string;
    notes?: string;
    preferredBillId?: string | null;
    preferredInstallmentId?: string | null;
    allowOverpayment?: boolean;
  },
) {
  const supplierId = input.supplierId.trim();
  const recordedByUserId = input.recordedByUserId.trim();
  if (!supplierId) throw new Error("Supplier is required.");
  if (!recordedByUserId) throw new Error("Payment recorder is required.");
  const paymentAmount = positivePaymentAmount(input.amount);
  const supplier = await tx.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true },
  });
  if (!supplier) throw new Error("Supplier not found.");

  const preferredBillId = input.preferredBillId?.trim() || null;
  const preferredInstallmentId =
    input.preferredInstallmentId?.trim() || null;
  const targets = await getSupplierAllocationTargets(tx, supplierId);
  const preferredTarget = preferredInstallmentId
    ? targets.find(
        (target) =>
          target.billId === preferredBillId &&
          target.installmentId === preferredInstallmentId,
      )
    : preferredBillId
      ? targets.find((target) => target.billId === preferredBillId)
      : null;
  if (preferredBillId && !preferredTarget) {
    throw new Error("This supplier obligation is no longer outstanding.");
  }
  if (
    preferredTarget &&
    paymentAmount.gt(preferredTarget.remainingAmount) &&
    !input.allowOverpayment
  ) {
    throw new Error(
      "Confirm that the extra amount may pay other invoices or become supplier credit.",
    );
  }

  const plan = planSupplierPaymentAllocations({
    amount: paymentAmount,
    targets,
    preferredBillId,
    preferredInstallmentId,
  });
  const payment = await tx.supplierPayment.create({
    data: {
      supplierId,
      amount: plan.paymentAmount,
      paymentMethod: input.paymentMethod?.trim() || null,
      notes: input.notes?.trim() || null,
      recordedByUserId,
    },
  });
  if (plan.allocations.length) {
    await tx.supplierPaymentAllocation.createMany({
      data: plan.allocations.map((allocation) => ({
        supplierPaymentId: payment.id,
        billId: allocation.billId,
        installmentId: allocation.installmentId,
        amount: allocation.amount,
        appliedByUserId: recordedByUserId,
      })),
    });
  }
  const invoiceIds = await recalculateSupplierBills(
    tx,
    plan.allocations.map((allocation) => allocation.billId),
  );
  return {
    payment,
    allocations: plan.allocations,
    unallocatedAmount: plan.unallocatedAmount,
    invoiceIds,
  };
}

export async function recordSupplierPayment(
  input: Parameters<typeof recordSupplierPaymentInTransaction>[1],
) {
  return prisma.$transaction(
    (tx) => recordSupplierPaymentInTransaction(tx, input),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function applyAvailableSupplierCreditToBillInTransaction(
  tx: Tx,
  input: { supplierId: string; billId: string; appliedByUserId: string },
) {
  const targets = (await getSupplierAllocationTargets(tx, input.supplierId))
    .filter((target) => target.billId === input.billId);
  if (!targets.length) return new Prisma.Decimal(0);
  const payments = await tx.supplierPayment.findMany({
    where: { supplierId: input.supplierId },
    select: { id: true, amount: true, allocations: { select: { amount: true } } },
    orderBy: [{ paidAt: "asc" }, { id: "asc" }],
  });
  let applied = new Prisma.Decimal(0);
  const mutableTargets = targets.map((target) => ({ ...target }));
  const allocationRows: Prisma.SupplierPaymentAllocationCreateManyInput[] = [];
  for (const payment of payments) {
    const used = payment.allocations.reduce(
      (sum, allocation) => sum.add(allocation.amount),
      new Prisma.Decimal(0),
    );
    const available = payment.amount.sub(used);
    if (available.lte(0)) continue;
    const plan = planSupplierPaymentAllocations({
      amount: available,
      targets: mutableTargets,
      preferredBillId: input.billId,
    });
    if (!plan.allocations.length) break;
    allocationRows.push(
      ...plan.allocations.map((allocation) => ({
        supplierPaymentId: payment.id,
        billId: allocation.billId,
        installmentId: allocation.installmentId,
        amount: allocation.amount,
        appliedByUserId: input.appliedByUserId,
      })),
    );
    for (const allocation of plan.allocations) {
      const target = mutableTargets.find(
        (row) =>
          row.billId === allocation.billId &&
          row.installmentId === allocation.installmentId,
      );
      if (target) {
        target.remainingAmount = target.remainingAmount.sub(allocation.amount);
      }
      applied = applied.add(allocation.amount);
    }
  }
  if (allocationRows.length) {
    await tx.supplierPaymentAllocation.createMany({ data: allocationRows });
  }
  await recalculateSupplierBills(tx, [input.billId]);
  return applied;
}

export async function revertSupplierPayment(
  paymentId: string,
  options: { canManageDailyCash: boolean; now?: Date },
) {
  const id = paymentId.trim();
  if (!id) throw new Error("Supplier payment not found.");
  const now = options.now ?? new Date();

  return prisma.$transaction(
    async (tx) => {
      const payment = await tx.supplierPayment.findUnique({
        where: { id },
        include: {
          allocations: {
            select: {
              billId: true,
              installmentId: true,
              bill: {
                select: {
                  invoiceId: true,
                  _count: { select: { installments: true } },
                },
              },
            },
          },
          dailyCashPayment: {
            include: {
              dailyCashDay: { select: { businessDate: true } },
            },
          },
        },
      });
      if (!payment) throw new Error("Supplier payment not found.");

      const dailyCashBusinessDate =
        payment.dailyCashPayment?.dailyCashDay.businessDate;
      const reversalError = getSupplierPaymentReversalError({
        legacyAllocationAfterSchedule: payment.allocations.some(
          (allocation) =>
            !allocation.installmentId &&
            allocation.bill._count.installments > 0,
        ),
        dailyCashLinked: Boolean(payment.dailyCashPayment),
        dailyCashLocked: dailyCashBusinessDate
          ? isDailyCashLocked(formatBusinessDateKey(dailyCashBusinessDate), now)
          : false,
        canManageDailyCash: options.canManageDailyCash,
      });
      if (reversalError) throw new Error(reversalError);

      if (payment.dailyCashPayment) {
        await tx.dailyCashSupplierPayment.delete({
          where: { id: payment.dailyCashPayment.id },
        });
      }
      await tx.supplierPayment.delete({ where: { id } });
      const invoiceIds = await recalculateSupplierBills(
        tx,
        payment.allocations.map((allocation) => allocation.billId),
      );

      return {
        supplierId: payment.supplierId,
        invoiceIds,
        dailyCashBusinessDate: dailyCashBusinessDate
          ? formatBusinessDateKey(dailyCashBusinessDate)
          : null,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateSupplierBillDueDate(billId: string, dueDate: Date) {
  const [bill, result] = await Promise.all([
    prisma.supplierBill.findUnique({
      where: { id: billId },
      select: { invoiceId: true },
    }),
    prisma.supplierBill.updateMany({
      where: {
        id: billId,
        status: { in: ["UNPAID", "PARTIAL"] },
      },
      data: { dueDate },
    }),
  ]);

  if (result.count !== 1) {
    throw new Error(
      "Only unpaid supplier bills can have their due date changed.",
    );
  }

  if (!bill) throw new Error("Supplier bill not found.");
  return { invoiceId: bill.invoiceId };
}

 type SupplierInstallmentScheduleInput = {
  dueDate: Date;
  amount: number;
};

/** Converts a legacy bill only when explicitly requested, preserving its old payments. */
export async function splitSupplierBillIntoInstallments(
  billId: string,
  input: readonly SupplierInstallmentScheduleInput[],
) {
  if (!input.length) throw new Error("Add at least one installment.");
  if (input.some((row) => !Number.isFinite(row.amount) || row.amount <= 0)) {
    throw new Error("Every installment amount must be positive.");
  }

  return prisma.$transaction(
    async (tx) => {
      const bill = await tx.supplierBill.findUnique({
        where: { id: billId },
        include: { installments: true },
      });
      if (!bill || bill.status === "PAID") {
        throw new Error("Only unpaid supplier bills can be split into installments.");
      }
      if (bill.installments.length) {
        throw new Error("This supplier bill already has an installment schedule.");
      }

      const remaining = bill.totalAmount.sub(bill.paidAmount);
      const scheduled = input.reduce(
        (sum, row) => sum.add(new Prisma.Decimal(row.amount)),
        new Prisma.Decimal(0),
      );
      if (!scheduled.equals(remaining)) {
        throw new Error(`Installments must total the remaining balance of ${remaining.toFixed(2)}.`);
      }

      const dates = input.map((row) => row.dueDate);
      const earliest = dates.reduce(
        (first, date) => (date < first ? date : first),
        dates[0],
      );
      await tx.supplierInvoiceInstallment.createMany({
        data: input.map((row, index) => ({
          invoiceId: bill.invoiceId,
          billId: bill.id,
          sequence: index + 1,
          amount: new Prisma.Decimal(row.amount).toDecimalPlaces(2),
          dueDate: row.dueDate,
        })),
      });
      await Promise.all([
        tx.supplierInvoice.update({
          where: { id: bill.invoiceId },
          data: { dueDate: earliest },
        }),
        tx.supplierBill.update({
          where: { id: bill.id },
          data: { dueDate: earliest },
        }),
      ]);
      return { invoiceId: bill.invoiceId };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recordSupplierPayment(
  billId: string,
  recordedByUserId: string,
  amount: number,
  paymentMethod?: string,
  notes?: string,
  installmentId?: string | null,
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be positive.");
  }

  return prisma.$transaction(
    async (tx) => {
      const bill = await tx.supplierBill.findUnique({
        where: { id: billId },
        include: { installments: { orderBy: [{ dueDate: "asc" }, { sequence: "asc" }] } },
      });
      if (!bill) throw new Error("Supplier bill not found.");

      const selectedInstallmentId = installmentId?.trim() || null;
      if (bill.installments.length && !selectedInstallmentId) {
        throw new Error("Choose the installment this payment is for.");
      }
      if (!bill.installments.length && selectedInstallmentId) {
        throw new Error("This supplier bill does not have an installment schedule.");
      }

      const paymentAmount = new Prisma.Decimal(amount);
      const nextPaid = bill.paidAmount.add(paymentAmount);
      if (nextPaid.greaterThan(bill.totalAmount)) {
        throw new Error("Payment exceeds the remaining balance.");
      }
      const isPaid = nextPaid.equals(bill.totalAmount);
      const installment = selectedInstallmentId
        ? bill.installments.find((row) => row.id === selectedInstallmentId)
        : null;
      if (selectedInstallmentId && !installment) {
        throw new Error("Installment not found for this supplier bill.");
      }
      if (
        installment &&
        installment.paidAmount.add(paymentAmount).greaterThan(installment.amount)
      ) {
        throw new Error("Payment exceeds the remaining installment balance.");
      }

      const payment = await tx.supplierPayment.create({
        data: {
          billId,
          installmentId: selectedInstallmentId,
          amount: paymentAmount,
          paymentMethod: paymentMethod?.trim() || null,
          notes: notes?.trim() || null,
          recordedByUserId,
        },
      });

      if (installment) {
        const installmentPaid = installment.paidAmount.add(paymentAmount);
        await tx.supplierInvoiceInstallment.update({
          where: { id: installment.id },
          data: {
            paidAmount: installmentPaid,
            status: installmentPaid.equals(installment.amount)
              ? "PAID"
              : "PARTIAL",
          },
        });
      }

      const unpaidDates: Date[] = [];
      for (const row of bill.installments) {
        const paidAfterPayment = row.id === installment?.id
          ? row.paidAmount.add(paymentAmount)
          : row.paidAmount;
        if (!paidAfterPayment.equals(row.amount)) unpaidDates.push(row.dueDate);
      }
      unpaidDates.sort((first, second) => first.getTime() - second.getTime());
      const nextDueDate = unpaidDates[0] ?? bill.dueDate;

      await tx.supplierBill.update({
        where: { id: billId },
        data: {
          paidAmount: nextPaid,
          status: isPaid ? "PAID" : "PARTIAL",
          dueDate: nextDueDate,
          settledAt: isPaid ? payment.paidAt : null,
          settledByUserId: isPaid ? recordedByUserId : null,
        },
      });

      return { payment, invoiceId: bill.invoiceId };
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

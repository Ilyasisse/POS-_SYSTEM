import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recordSupplierPayment(
  billId: string,
  recordedByUserId: string,
  amount: number,
  paymentMethod?: string,
  notes?: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be positive.");
  }

  return prisma.$transaction(
    async (tx) => {
      const bill = await tx.supplierBill.findUnique({ where: { id: billId } });
      if (!bill) throw new Error("Supplier bill not found.");

      const paymentAmount = new Prisma.Decimal(amount);
      const nextPaid = bill.paidAmount.add(paymentAmount);
      if (nextPaid.greaterThan(bill.totalAmount)) {
        throw new Error("Payment exceeds the remaining balance.");
      }
      const isPaid = nextPaid.equals(bill.totalAmount);

      const payment = await tx.supplierPayment.create({
        data: {
          billId,
          amount: paymentAmount,
          paymentMethod: paymentMethod?.trim() || null,
          notes: notes?.trim() || null,
          recordedByUserId,
        },
      });

      await tx.supplierBill.update({
        where: { id: billId },
        data: {
          paidAmount: nextPaid,
          status: isPaid ? "PAID" : "PARTIAL",
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

import "server-only";

import { prisma } from "@/lib/prisma";
import { buildAccountingJournal } from "@/lib/accounting/accounting-journal-domain";
import type { ReportRange } from "@/lib/reports/reporting-calendar";

function databaseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getAccountingJournal(input: {
  activityRange: ReportRange;
  fromDate: string;
  toDate: string;
}) {
  const dateStart = databaseDate(input.fromDate);
  const dateEnd = databaseDate(input.toDate);
  const [payments, expenses, supplierPayments, ownerWithdrawals, settings] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: input.activityRange.start, lt: input.activityRange.end } },
      select: { id: true, createdAt: true, method: true, amountPaid: true, reference: true, order: { select: { orderNumber: true } } },
    }),
    prisma.expenseTransaction.findMany({
      where: { status: "APPROVED", paidAt: { gte: dateStart, lte: dateEnd } },
      select: { id: true, paidAt: true, amount: true, paymentMethod: true, vendor: true, receiptReference: true, category: { select: { name: true } } },
    }),
    prisma.supplierPayment.findMany({
      where: { paidAt: { gte: input.activityRange.start, lt: input.activityRange.end } },
      select: { id: true, paidAt: true, amount: true, paymentMethod: true, supplier: { select: { name: true } }, allocations: { select: { amount: true } } },
    }),
    prisma.ownerWithdrawal.findMany({
      where: { withdrawnAt: { gte: dateStart, lte: dateEnd } },
      select: { id: true, withdrawnAt: true, amount: true, reason: true, receiptReference: true },
    }),
    prisma.cafeSetting.findUnique({ where: { id: "default" }, select: { currencyCode: true } }),
  ]);

  return {
    currencyCode: settings?.currencyCode ?? "USD",
    rows: buildAccountingJournal({
      payments: payments.map((payment) => ({ id: payment.id, date: payment.createdAt, method: payment.method, amount: Number(payment.amountPaid), orderNumber: payment.order.orderNumber, reference: payment.reference })),
      expenses: expenses.map((expense) => ({ id: expense.id, date: expense.paidAt, category: expense.category.name, amount: Number(expense.amount), paymentMethod: expense.paymentMethod, vendor: expense.vendor, reference: expense.receiptReference })),
      supplierPayments: supplierPayments.map((payment) => ({ id: payment.id, date: payment.paidAt, supplier: payment.supplier.name, amount: Number(payment.amount), allocatedAmount: payment.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0), paymentMethod: payment.paymentMethod })),
      ownerWithdrawals: ownerWithdrawals.map((withdrawal) => ({ id: withdrawal.id, date: withdrawal.withdrawnAt, amount: Number(withdrawal.amount), reason: withdrawal.reason, reference: withdrawal.receiptReference })),
    }),
  };
}

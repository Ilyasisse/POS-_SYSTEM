import { roundMoney } from "./money";
import type { DailyCashPaidBreakdownRow } from "./types";

type PaidBreakdownInput = {
  dayId: string;
  salary: {
    amount: number;
    paidAt: Date | null;
    revenueFunded: number;
    savingsFunded: number;
  };
  manualExpenses: Array<{
    id: string;
    description: string;
    note: string | null;
    amount: number;
    revenueFunded: number;
    savingsFunded: number;
    createdAt: Date;
  }>;
  supplierPayments: Array<{
    id: string;
    supplierName: string;
    invoiceNumber: string | null;
    amount: number;
    revenueFunded: number;
    savingsFunded: number;
    paidAt: Date;
  }>;
};

export function buildDailyCashPaidBreakdown(input: PaidBreakdownInput): DailyCashPaidBreakdownRow[] {
  const rows: DailyCashPaidBreakdownRow[] = [];

  if (input.salary.paidAt && input.salary.amount > 0) {
    rows.push({
      id: `salary:${input.dayId}`,
      type: "SALARY",
      description: "Combined daily salary",
      paidAt: input.salary.paidAt,
      amount: roundMoney(input.salary.amount),
      revenueFunded: roundMoney(input.salary.revenueFunded),
      savingsFunded: roundMoney(input.salary.savingsFunded),
    });
  }

  for (const expense of input.manualExpenses) {
    rows.push({
      id: `manual:${expense.id}`,
      type: "MANUAL",
      description: expense.note ? `${expense.description} · ${expense.note}` : expense.description,
      paidAt: expense.createdAt,
      amount: roundMoney(expense.amount),
      revenueFunded: roundMoney(expense.revenueFunded),
      savingsFunded: roundMoney(expense.savingsFunded),
    });
  }

  for (const payment of input.supplierPayments) {
    rows.push({
      id: `supplier:${payment.id}`,
      type: "SUPPLIER",
      description: `${payment.supplierName} · ${payment.invoiceNumber ?? "No invoice #"}`,
      paidAt: payment.paidAt,
      amount: roundMoney(payment.amount),
      revenueFunded: roundMoney(payment.revenueFunded),
      savingsFunded: roundMoney(payment.savingsFunded),
    });
  }

  return rows.sort((left, right) => left.paidAt.getTime() - right.paidAt.getTime() || left.id.localeCompare(right.id));
}

export function calculatePaidBreakdownTotals(revenue: number, rows: DailyCashPaidBreakdownRow[]) {
  const savingsUsed = roundMoney(rows.reduce((sum, row) => sum + row.savingsFunded, 0));
  const totalPaid = roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));
  const currentRemaining = Math.max(0, roundMoney(revenue + savingsUsed - totalPaid));

  return { savingsUsed, totalPaid, currentRemaining };
}

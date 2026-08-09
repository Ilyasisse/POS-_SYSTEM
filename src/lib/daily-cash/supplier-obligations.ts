import type { SupplierObligation } from "./types";
import { roundMoney } from "./money";
import { formatSupplierInvoiceNumber } from "@/lib/suppliers/invoice-number";

type Bill = {
  id: string;
  dueDate: Date;
  totalAmount: { toString(): string };
  paidAmount: { toString(): string };
  status: "UNPAID" | "PARTIAL" | "PAID";
  supplier: { name: string };
  invoice: { invoiceNumber: number };
  installments: Array<{ id: string; dueDate: Date; sequence?: number; amount: { toString(): string }; paidAmount: { toString(): string }; status: "UNPAID" | "PARTIAL" | "PAID" }>;
};

export function selectDailyCashObligations(bills: readonly Bill[]): SupplierObligation[] {
  return bills.flatMap((bill) => {
    if (bill.status === "PAID") return [];
    const scheduled = bill.installments
      .filter((row) => row.status !== "PAID")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || (a.sequence ?? 0) - (b.sequence ?? 0))[0];
    if (bill.installments.length && !scheduled) return [];
    const dueDate = scheduled?.dueDate ?? bill.dueDate;
    const amount = scheduled
      ? Number(scheduled.amount) - Number(scheduled.paidAmount)
      : Number(bill.totalAmount) - Number(bill.paidAmount);
    if (amount <= 0) return [];
    return [{ billId: bill.id, installmentId: scheduled?.id ?? null, supplierName: bill.supplier.name, invoiceNumber: formatSupplierInvoiceNumber(bill.invoice.invoiceNumber), dueDate, amount }];
  }).sort((first, second) =>
    first.dueDate.getTime() - second.dueDate.getTime() ||
    first.supplierName.localeCompare(second.supplierName) ||
    first.invoiceNumber.localeCompare(second.invoiceNumber) ||
    first.billId.localeCompare(second.billId),
  );
}

export function validateSupplierObligationPaymentAmount(requestedAmount: number, remainingBalance: number) {
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new Error("Enter a payment amount greater than zero.");
  }
  const amount = roundMoney(requestedAmount);
  const remaining = roundMoney(remainingBalance);
  if (amount > remaining) {
    throw new Error(`Payment cannot exceed the remaining balance of $${remaining.toFixed(2)}.`);
  }
  return amount;
}

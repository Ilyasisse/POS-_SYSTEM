import assert from "node:assert/strict";
import test from "node:test";
import { validateSupplierInvoiceDraftInput } from "../../src/lib/suppliers/invoice-foundation";
import { summarizeSupplierBillsDue } from "../../src/lib/suppliers/supplier-bills";
import { supplierPurchaseDateKeyToDatabaseDate } from "../../src/lib/suppliers/purchase-orders";

function date(value: string) {
  const parsed = supplierPurchaseDateKeyToDatabaseDate(value);
  if (!parsed) throw new Error("invalid test date");
  return parsed;
}

function draft(installments: Array<{ dueDate: string; amount: string }>) {
  return {
    invoiceDate: "2026-07-27",
    dueDate: "2026-07-28",
    lines: [{ kind: "custom" as const, itemName: "Beans", itemUnit: "bag", quantity: "1", unitPrice: "60.00" }],
    installments,
  };
}

test("accepts an installment schedule that exactly matches the invoice total", () => {
  const result = validateSupplierInvoiceDraftInput(draft([
    { dueDate: "2026-07-28", amount: "30.00" },
    { dueDate: "2026-08-01", amount: "20.00" },
    { dueDate: "2026-08-08", amount: "10.00" },
  ]));
  assert.equal(result.installments?.length, 3);
  assert.equal(result.totalAmount.toString(), "60");
});

test("rejects a schedule that does not equal the invoice total", () => {
  assert.throws(
    () => validateSupplierInvoiceDraftInput(draft([{ dueDate: "2026-07-28", amount: "59.99" }])),
    /Installments total/,
  );
});

test("due summary counts only due installments, not the full invoice", () => {
  const summary = summarizeSupplierBillsDue([{
    id: "bill-1", supplierId: "supplier-1", supplierName: "Fresh Beans",
    dueDate: date("2026-07-28"), totalAmount: 60, paidAmount: 0, status: "UNPAID",
    installments: [
      { dueDate: date("2026-07-28"), amount: 30, paidAmount: 0, status: "UNPAID" },
      { dueDate: date("2026-08-02"), amount: 20, paidAmount: 0, status: "UNPAID" },
      { dueDate: date("2026-08-09"), amount: 10, paidAmount: 0, status: "UNPAID" },
    ],
  }], new Date("2026-07-27T12:00:00.000Z"));
  assert.equal(summary.dueTomorrowRemaining, 30);
  assert.equal(summary.totalRemaining, 30);
  assert.equal(summary.billCount, 1);
});

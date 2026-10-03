import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { Prisma } from "@prisma/client";

const state = { bill: null, installments: [], transactionCount: 0 };
const tx = {
  supplierBill: {
    async findUnique() {
      return state.bill;
    },
    async update() {},
  },
  supplierInvoice: { async update() {} },
  supplierInvoiceInstallment: {
    async createMany({ data }) {
      state.installments = data;
    },
  },
};
globalThis.supplierBillTestPrisma = {
  async $transaction(operation) {
    state.transactionCount += 1;
    return operation(tx);
  },
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only" || specifier === "@/lib/prisma") {
      return {
        url: new URL("../helpers/supplier-bill-runtime.cjs", import.meta.url)
          .href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { splitSupplierBillIntoInstallments } =
  await import("../../src/lib/suppliers/bill-service.ts");
hooks.deregister();
delete globalThis.supplierBillTestPrisma;

const dueDate = new Date("2026-10-03T00:00:00.000Z");
function resetBill(totalAmount, paidAmount = "0") {
  state.bill = {
    id: "bill-1",
    invoiceId: "invoice-1",
    totalAmount: new Prisma.Decimal(totalAmount),
    paidAmount: new Prisma.Decimal(paidAmount),
    status: paidAmount === "0" ? "UNPAID" : "PARTIAL",
    installments: [],
  };
  state.installments = [];
  state.transactionCount = 0;
}

test("rejects fractional-cent installments that would change the balance when stored", async () => {
  resetBill("0.03");
  await assert.rejects(
    splitSupplierBillIntoInstallments("bill-1", [
      { dueDate, amount: 0.015 },
      { dueDate, amount: 0.015 },
    ]),
    /at most two decimal places/,
  );
  assert.equal(state.installments.length, 0);
  assert.equal(state.transactionCount, 0);
});

test("splits only the remaining balance and preserves exact cents", async () => {
  resetBill("100", "25");
  const result = await splitSupplierBillIntoInstallments("bill-1", [
    { dueDate, amount: 30.25 },
    { dueDate: new Date("2026-10-10T00:00:00.000Z"), amount: 44.75 },
  ]);
  assert.deepEqual(result, { invoiceId: "invoice-1" });
  assert.deepEqual(
    state.installments.map((row) => row.amount.toFixed(2)),
    ["30.25", "44.75"],
  );
  assert.equal(state.bill.paidAmount.toFixed(2), "25.00");
});

test("rejects invalid installment dates before writing a schedule", async () => {
  resetBill("51");
  await assert.rejects(
    splitSupplierBillIntoInstallments("bill-1", [
      { dueDate: new Date("invalid"), amount: 51 },
    ]),
    /valid due date/,
  );
  assert.equal(state.installments.length, 0);
  assert.equal(state.transactionCount, 0);
});

test("rejects schedules beyond the invoice installment limit", async () => {
  resetBill("51");
  await assert.rejects(
    splitSupplierBillIntoInstallments(
      "bill-1",
      Array.from({ length: 51 }, () => ({ dueDate, amount: 1 })),
    ),
    /at most 50 installments/,
  );
  assert.equal(state.installments.length, 0);
});

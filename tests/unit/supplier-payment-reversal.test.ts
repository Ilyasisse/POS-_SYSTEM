import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSupplierPaymentState,
  getSupplierPaymentReversalError,
} from "../../src/lib/suppliers/payment-reversal";

const dueDate = new Date("2026-08-04T00:00:00.000Z");

test("returns a bill to unpaid after its only payment is removed", () => {
  const state = calculateSupplierPaymentState({
    totalAmount: "100.00",
    dueDate,
    allocations: [],
    installments: [],
  });

  assert.equal(state.bill.paidAmount.toFixed(2), "0.00");
  assert.equal(state.bill.status, "UNPAID");
  assert.equal(state.bill.settledAt, null);
  assert.equal(state.bill.settledByUserId, null);
  assert.equal(state.bill.dueDate, dueDate);
});

test("keeps a bill partially paid when another payment remains", () => {
  const state = calculateSupplierPaymentState({
    totalAmount: "100.00",
    dueDate,
    allocations: [
      {
        amount: "40.00",
        installmentId: null,
        allocatedAt: new Date("2026-08-04T08:00:00.000Z"),
        appliedByUserId: "user-1",
      },
    ],
    installments: [],
  });

  assert.equal(state.bill.paidAmount.toFixed(2), "40.00");
  assert.equal(state.bill.status, "PARTIAL");
  assert.equal(state.bill.settledAt, null);
});

test("recalculates installments and restores the earliest outstanding due date", () => {
  const firstDueDate = new Date("2026-08-04T00:00:00.000Z");
  const secondDueDate = new Date("2026-08-10T00:00:00.000Z");
  const state = calculateSupplierPaymentState({
    totalAmount: "100.00",
    dueDate: secondDueDate,
    allocations: [
      {
        amount: "70.00",
        installmentId: "installment-2",
        allocatedAt: new Date("2026-08-04T08:00:00.000Z"),
        appliedByUserId: "user-1",
      },
    ],
    installments: [
      { id: "installment-1", amount: "30.00", dueDate: firstDueDate },
      { id: "installment-2", amount: "70.00", dueDate: secondDueDate },
    ],
  });

  assert.equal(state.bill.status, "PARTIAL");
  assert.equal(state.bill.dueDate, firstDueDate);
  assert.deepEqual(
    state.installments.map((row) => [
      row.id,
      row.paidAmount.toFixed(2),
      row.status,
    ]),
    [
      ["installment-1", "0.00", "UNPAID"],
      ["installment-2", "70.00", "PAID"],
    ],
  );
});

test("blocks unsafe scheduled and Daily Cash reversals", () => {
  assert.match(
    getSupplierPaymentReversalError({
      legacyAllocationAfterSchedule: true,
      dailyCashLinked: false,
      dailyCashLocked: false,
      canManageDailyCash: true,
    }) || "",
    /installment schedule/,
  );
  assert.match(
    getSupplierPaymentReversalError({
      dailyCashLinked: true,
      dailyCashLocked: false,
      canManageDailyCash: false,
    }) || "",
    /permission/,
  );
  assert.match(
    getSupplierPaymentReversalError({
      dailyCashLinked: true,
      dailyCashLocked: true,
      canManageDailyCash: true,
    }) || "",
    /permanently locked/,
  );
});

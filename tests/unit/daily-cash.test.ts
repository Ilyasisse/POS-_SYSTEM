import assert from "node:assert/strict";
import test from "node:test";
import { calculateDailyCashSummary, fundingFor } from "../../src/lib/daily-cash/money";
import { buildDailyCashPaidBreakdown, calculatePaidBreakdownTotals } from "../../src/lib/daily-cash/paid-breakdown";
import { resolveDailySalaryRate } from "../../src/lib/daily-cash/salary-rates";
import { selectDailyCashObligations, validateSupplierObligationPaymentAmount } from "../../src/lib/daily-cash/supplier-obligations";

test("Daily Cash uses revenue before savings and never projects a negative balance", () => {
  assert.deepEqual(fundingFor(400, 324.5), { revenueFunded: 324.5, savingsFunded: 75.5 });
  assert.deepEqual(calculateDailyCashSummary({ revenue: 450, paidRevenueFunded: 125.5, paidSavingsFunded: 0, unpaidRequired: 400 }), {
    cashAvailableNow: 324.5,
    projectedRemaining: 0,
    additionalSavingsRequired: 75.5,
    savingsUsed: 0,
  });
});

test("Daily Cash resolves the newest salary rate effective on the business date", () => {
  const rate = resolveDailySalaryRate(new Date("2026-08-04T00:00:00.000Z"), [
    { effectiveBusinessDate: new Date("2026-08-01T00:00:00.000Z"), amount: 100 },
    { effectiveBusinessDate: new Date("2026-08-04T00:00:00.000Z"), amount: 125.5 },
  ]);
  assert.equal(rate?.amount, 125.5);
});

test("Daily Cash includes overdue and upcoming obligations", () => {
  const rows = selectDailyCashObligations([{
    id: "bill-1", dueDate: new Date("2026-08-01T00:00:00.000Z"), totalAmount: 900, paidAmount: 0, status: "UNPAID",
    supplier: { name: "Milk supplier" }, invoice: { invoiceNumber: 1 },
    installments: [
      { id: "past", dueDate: new Date("2026-07-28T00:00:00.000Z"), amount: 300, paidAmount: 0, status: "UNPAID" },
      { id: "future", dueDate: new Date("2026-08-10T00:00:00.000Z"), amount: 300, paidAmount: 0, status: "UNPAID" },
    ],
  }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].installmentId, "past");
  assert.equal(rows[0].amount, 300);
});

test("Daily Cash includes future-due bills and sorts oldest first", () => {
  const rows = selectDailyCashObligations([
    { id: "future", dueDate: new Date("2026-08-05T00:00:00.000Z"), totalAmount: 54, paidAmount: 0, status: "UNPAID", supplier: { name: "Al Cayn" }, invoice: { invoiceNumber: 47 }, installments: [] },
    { id: "due", dueDate: new Date("2026-08-04T00:00:00.000Z"), totalAmount: 67.5, paidAmount: 0, status: "UNPAID", supplier: { name: "Haysimo" }, invoice: { invoiceNumber: 43 }, installments: [] },
    { id: "paid", dueDate: new Date("2026-07-01T00:00:00.000Z"), totalAmount: 100, paidAmount: 100, status: "PAID", supplier: { name: "Paid" }, invoice: { invoiceNumber: 99 }, installments: [] },
  ]);
  assert.deepEqual(rows.map((row) => row.invoiceNumber), ["INV-000043", "INV-000047"]);
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), 121.5);
});

test("Daily Cash accepts partial supplier payments up to the remaining balance", () => {
  assert.equal(validateSupplierObligationPaymentAmount(20, 67.5), 20);
  assert.equal(validateSupplierObligationPaymentAmount(67.5, 67.5), 67.5);
  assert.throws(() => validateSupplierObligationPaymentAmount(0, 67.5), /greater than zero/);
  assert.throws(() => validateSupplierObligationPaymentAmount(68, 67.5), /cannot exceed/);
});

test("paid salary produces one breakdown row while unpaid salary is excluded", () => {
  const base = {
    dayId: "day-1",
    manualExpenses: [],
    supplierPayments: [],
  };
  const paidAt = new Date("2026-08-04T07:00:00.000Z");
  const paid = buildDailyCashPaidBreakdown({
    ...base,
    salary: { amount: 125.5, paidAt, revenueFunded: 100, savingsFunded: 25.5 },
  });
  const unpaid = buildDailyCashPaidBreakdown({
    ...base,
    salary: { amount: 125.5, paidAt: null, revenueFunded: 0, savingsFunded: 0 },
  });

  assert.deepEqual(paid, [{
    id: "salary:day-1",
    type: "SALARY",
    description: "Combined daily salary",
    paidAt,
    amount: 125.5,
    revenueFunded: 100,
    savingsFunded: 25.5,
  }]);
  assert.deepEqual(unpaid, []);
});

test("manual and supplier breakdown rows include descriptions, funding splits, and chronological order", () => {
  const rows = buildDailyCashPaidBreakdown({
    dayId: "day-1",
    salary: { amount: 0, paidAt: null, revenueFunded: 0, savingsFunded: 0 },
    manualExpenses: [{
      id: "manual-1",
      description: "Taxi",
      note: "Market run",
      amount: 20,
      revenueFunded: 15,
      savingsFunded: 5,
      createdAt: new Date("2026-08-04T09:00:00.000Z"),
    }],
    supplierPayments: [{
      id: "supplier-1",
      supplierName: "Haysimo",
      invoiceNumber: "INV-000043",
      amount: 67.5,
      revenueFunded: 60,
      savingsFunded: 7.5,
      paidAt: new Date("2026-08-04T08:00:00.000Z"),
    }],
  });

  assert.deepEqual(rows.map((row) => row.type), ["SUPPLIER", "MANUAL"]);
  assert.equal(rows[0].description, "Haysimo · INV-000043");
  assert.deepEqual([rows[0].revenueFunded, rows[0].savingsFunded], [60, 7.5]);
  assert.equal(rows[1].description, "Taxi · Market run");
  assert.deepEqual([rows[1].revenueFunded, rows[1].savingsFunded], [15, 5]);
});

test("paid breakdown totals reconcile revenue and savings to current remaining cash", () => {
  const rows = buildDailyCashPaidBreakdown({
    dayId: "day-1",
    salary: { amount: 125.5, paidAt: new Date("2026-08-04T07:00:00.000Z"), revenueFunded: 125.5, savingsFunded: 0 },
    manualExpenses: [{ id: "manual-1", description: "Taxi", note: null, amount: 30, revenueFunded: 24.5, savingsFunded: 5.5, createdAt: new Date("2026-08-04T08:00:00.000Z") }],
    supplierPayments: [{ id: "supplier-1", supplierName: "Haysimo", invoiceNumber: "INV-000043", amount: 300, revenueFunded: 300, savingsFunded: 0, paidAt: new Date("2026-08-04T09:00:00.000Z") }],
  });

  const totals = calculatePaidBreakdownTotals(500, rows);
  const summary = calculateDailyCashSummary({
    revenue: 500,
    paidRevenueFunded: 450,
    paidSavingsFunded: 5.5,
    unpaidRequired: 0,
  });

  assert.deepEqual(totals, {
    savingsUsed: 5.5,
    totalPaid: 455.5,
    currentRemaining: 50,
  });
  assert.equal(totals.currentRemaining, summary.cashAvailableNow);
});

test("paid breakdown remaining cash stops at zero", () => {
  assert.deepEqual(calculatePaidBreakdownTotals(10, [{
    id: "manual:1",
    type: "MANUAL",
    description: "Emergency repair",
    paidAt: new Date("2026-08-04T10:00:00.000Z"),
    amount: 15,
    revenueFunded: 10,
    savingsFunded: 0,
  }]), {
    savingsUsed: 0,
    totalPaid: 15,
    currentRemaining: 0,
  });
});

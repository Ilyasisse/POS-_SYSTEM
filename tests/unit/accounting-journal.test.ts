import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountingJournal, toAccountingJournalCsv } from "../../src/lib/accounting/accounting-journal-domain";

test("builds balanced entries and separates supplier advances", () => {
  const rows = buildAccountingJournal({
    payments: [{ id: "p1", date: new Date("2026-09-01T10:00:00Z"), method: "GOLIS", amount: 20, orderNumber: 18, reference: "TIX-1" }],
    expenses: [{ id: "e1", date: new Date("2026-09-01T00:00:00Z"), category: "Utilities", amount: 5, paymentMethod: "CASH", vendor: "Water", reference: null }],
    supplierPayments: [{ id: "s1", date: new Date("2026-09-01T11:00:00Z"), supplier: "Meat Supplier", amount: 12, allocatedAmount: 9, paymentMethod: "GOLIS" }],
    ownerWithdrawals: [{ id: "w1", date: new Date("2026-09-01T00:00:00Z"), amount: 3, reason: "Owner draw", reference: null }],
  });

  const debit = rows.reduce((sum, row) => sum + row.debit, 0);
  const credit = rows.reduce((sum, row) => sum + row.credit, 0);
  assert.equal(debit, credit);
  assert.ok(rows.some((row) => row.account === "Accounts payable" && row.debit === 9));
  assert.ok(rows.some((row) => row.account === "Supplier advances" && row.debit === 3));
  assert.ok(rows.some((row) => row.account === "Cash on hand" && row.credit === 5));
});

test("CSV uses stable columns and neutralizes spreadsheet formulas", () => {
  const csv = toAccountingJournalCsv([
    { date: "2026-09-01", entryId: "entry-1", source: "EXPENSE", account: "Expense: Test", debit: 1, credit: 0, memo: "=HYPERLINK(\"bad\")", reference: "+cmd" },
  ], "USD");

  assert.match(csv, /^Date,Entry ID,Source,Account,Debit,Credit,Currency,Memo,Reference/);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"'\+cmd"/);
});

test("uses the Nairobi calendar date for timestamped activity", () => {
  const rows = buildAccountingJournal({
    payments: [{ id: "late", date: new Date("2026-09-01T22:30:00Z"), method: "GOLIS", amount: 1, orderNumber: 2, reference: null }],
    expenses: [],
    supplierPayments: [],
    ownerWithdrawals: [],
  });
  assert.ok(rows.every((row) => row.date === "2026-09-02"));
});

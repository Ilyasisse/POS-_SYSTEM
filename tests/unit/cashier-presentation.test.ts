import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesCashierTable,
  receiptAssignmentIssue,
  afterCashierItemAdded,
} from "../../src/lib/cashier/cashier-presentation";

test("table search supports whitespace, case-insensitive names and exact bill identities", () => {
  const table = { name: "Patio 02", billNumbers: [273, 300] };
  for (const query of ["", "  ", "PATIO", " #273 ", "300"])
    assert.equal(matchesCashierTable(table, query), true);
  for (const query of ["27", "#274", "Kitchen"])
    assert.equal(matchesCashierTable(table, query), false);
});

test("adding items clears notices without changing cart visibility, table or note", () => {
  for (const cartOpen of [false, true]) {
    const state = {
      cartOpen,
      tableId: "table-2",
      orderNote: "No sugar",
      message: "old",
      error: "old",
    };
    const next = afterCashierItemAdded(state);
    assert.equal(next.cartOpen, cartOpen);
    assert.equal(next.tableId, state.tableId);
    assert.equal(next.orderNote, state.orderNote);
    assert.equal(next.message, "");
    assert.equal(next.error, "");
    assert.equal(state.error, "old");
  }
});

test("receipt hints permit partial and exact amounts and reject invalid or excessive receipts", () => {
  const payer = { status: "PARTIALLY_MATCHED", remainingAmount: 8 };
  const receipt = { status: "AVAILABLE", direction: "INCOMING", amount: 8 };
  assert.equal(receiptAssignmentIssue(payer, receipt), null);
  assert.equal(receiptAssignmentIssue(payer, { ...receipt, amount: 3 }), null);
  assert.match(receiptAssignmentIssue(payer, { ...receipt, amount: 8.01 })!, /exceeds/);
  assert.match(receiptAssignmentIssue(null, receipt)!, /Select/);
  for (const amount of [null, NaN, Infinity, 0, -1])
    assert.match(receiptAssignmentIssue(payer, { ...receipt, amount })!, /amount review/);
  for (const status of ["ASSIGNED", "NEEDS_REVIEW", "OUTGOING"])
    assert.match(receiptAssignmentIssue(payer, { ...receipt, status })!, /available incoming/);
  assert.match(receiptAssignmentIssue(payer, { ...receipt, direction: "OUTGOING" })!, /incoming/);
  assert.match(receiptAssignmentIssue({ ...payer, status: "MATCHED" }, receipt)!, /fully matched/);
  for (const status of ["EXPIRED", "CANCELLED"])
    assert.match(receiptAssignmentIssue({ ...payer, status }, receipt)!, /no longer active/);
});

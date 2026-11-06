import assert from "node:assert/strict";
import test from "node:test";
import {
  groupOrderCards,
  type OrderCardRound,
} from "../../src/lib/admin/order-cards";

function round(overrides: Partial<OrderCardRound> = {}): OrderCardRound {
  return {
    id: "round-1",
    orderNumber: 101,
    tableCheckId: "check-1",
    tableCheckRound: 1,
    checkNumber: 101,
    tableName: "Table 07",
    type: "DINE_IN",
    status: "PAID",
    total: 18,
    createdAt: new Date("2026-09-30T09:00:00Z"),
    cashierName: "Amina",
    waiterName: null,
    customerName: null,
    itemCount: 2,
    ...overrides,
  };
}

test("combines every round of a check in round order with its shared number", () => {
  const older = round();
  const newer = round({
    id: "round-2", orderNumber: 102, tableCheckRound: 2,
    status: "OPEN", total: 42.5,
    createdAt: new Date("2026-09-30T10:00:00Z"),
  });
  const [card] = groupOrderCards([newer, older]);
  assert.ok(card);
  assert.equal(card.orderNumber, 101);
  assert.deepEqual(card.rounds.map((r) => r.id), ["round-1", "round-2"]);
  assert.equal(card.latest.id, "round-2");
  assert.equal(card.total, 60.5);
  assert.equal(card.status, "OPEN");
  assert.equal(newer.tableCheckRound, 2);
});

test("keeps separate visits to the same table in separate cards", () => {
  const cards = groupOrderCards([
    round(),
    round({ id: "other-visit", tableCheckId: "check-2", checkNumber: 103 }),
  ]);
  assert.equal(cards.length, 2);
});

test("standalone customer and legacy orders never merge by table or missing check", () => {
  const cards = groupOrderCards([
    round({ id: "takeout", tableCheckId: null, tableCheckRound: null,
      checkNumber: null, tableName: null, type: "TAKEOUT",
      customerName: "Layla", waiterName: null }),
    round({ id: "legacy", tableCheckId: null, tableCheckRound: null,
      checkNumber: null }),
  ]);
  assert.equal(cards.length, 2);
  assert.equal(cards[0]?.latest.customerName, "Layla");
  assert.equal(cards[0]?.latest.waiterName, null);
});

test("cancelled rounds remain visible but do not increase the check total", () => {
  const [card] = groupOrderCards([
    round(),
    round({ id: "cancelled", tableCheckRound: 2, status: "CANCELLED", total: 50 }),
  ]);
  assert.equal(card?.rounds.length, 2);
  assert.equal(card?.total, 18);
  assert.equal(card?.status, "PAID");
  const [cancelled] = groupOrderCards([round({ status: "CANCELLED" })]);
  assert.equal(cancelled?.status, "CANCELLED");
  assert.equal(cancelled?.total, 0);
});

test("empty results produce no cards", () => {
  assert.deepEqual(groupOrderCards([]), []);
});

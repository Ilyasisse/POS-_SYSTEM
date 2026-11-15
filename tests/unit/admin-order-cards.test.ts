import { expect, test } from "@jest/globals";

import { groupOrderCards, type OrderCardRound } from "../../src/lib/admin/order-cards";

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
    id: "round-2",
    orderNumber: 102,
    tableCheckRound: 2,
    status: "OPEN",
    total: 42.5,
    createdAt: new Date("2026-09-30T10:00:00Z"),
  });
  const [card] = groupOrderCards([newer, older]);
  expect(card).toBeTruthy();
  expect(card.orderNumber).toBe(101);
  expect(card.rounds.map((r) => r.id)).toStrictEqual(["round-1", "round-2"]);
  expect(card.latest.id).toBe("round-2");
  expect(card.total).toBe(60.5);
  expect(card.status).toBe("OPEN");
  expect(newer.tableCheckRound).toBe(2);
});

test("keeps separate visits to the same table in separate cards", () => {
  const cards = groupOrderCards([
    round(),
    round({ id: "other-visit", tableCheckId: "check-2", checkNumber: 103 }),
  ]);
  expect(cards.length).toBe(2);
});

test("standalone customer and legacy orders never merge by table or missing check", () => {
  const cards = groupOrderCards([
    round({
      id: "takeout",
      tableCheckId: null,
      tableCheckRound: null,
      checkNumber: null,
      tableName: null,
      type: "TAKEOUT",
      customerName: "Layla",
      waiterName: null,
    }),
    round({ id: "legacy", tableCheckId: null, tableCheckRound: null, checkNumber: null }),
  ]);
  expect(cards.length).toBe(2);
  expect(cards[0]?.latest.customerName).toBe("Layla");
  expect(cards[0]?.latest.waiterName).toBe(null);
});

test("cancelled rounds remain visible but do not increase the check total", () => {
  const [card] = groupOrderCards([
    round(),
    round({ id: "cancelled", tableCheckRound: 2, status: "CANCELLED", total: 50 }),
  ]);
  expect(card?.rounds.length).toBe(2);
  expect(card?.total).toBe(18);
  expect(card?.status).toBe("PAID");
  const [cancelled] = groupOrderCards([round({ status: "CANCELLED" })]);
  expect(cancelled?.status).toBe("CANCELLED");
  expect(cancelled?.total).toBe(0);
});

test("empty results produce no cards", () => {
  expect(groupOrderCards([])).toStrictEqual([]);
});

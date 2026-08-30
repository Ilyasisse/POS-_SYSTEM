import assert from "node:assert/strict";
import test from "node:test";
import {
  groupCashierOpenOrders,
  resolveTableCheckIdentity,
} from "../../src/lib/cashier/table-checks";

test("table-check identity keeps the customer number while exposing each ticket", () => {
  assert.deepEqual(
    resolveTableCheckIdentity({
      orderNumber: 102,
      tableCheckRound: 2,
      tableCheck: { checkNumber: 101 },
    }),
    { orderNumber: 101, ticketNumber: 102, roundNumber: 2 },
  );
});

test("legacy orders retain their original customer-facing number", () => {
  assert.deepEqual(resolveTableCheckIdentity({ orderNumber: 99 }), {
    orderNumber: 99,
    ticketNumber: 99,
    roundNumber: 1,
  });
});

test("cashier rounds group into one customer check and combined total", () => {
  const base = {
    tableCheckId: "check-1",
    tableCheck: { checkNumber: 101 },
    cashierName: "Cashier",
    items: [],
  };
  const checks = groupCashierOpenOrders([
    {
      ...base,
      id: "round-2",
      orderNumber: 102,
      tableCheckRound: 2,
      total: 4.5,
      createdAt: new Date("2026-08-30T10:05:00Z"),
    },
    {
      ...base,
      id: "round-1",
      orderNumber: 101,
      tableCheckRound: 1,
      total: 8,
      createdAt: new Date("2026-08-30T10:00:00Z"),
    },
  ]);

  assert.equal(checks.length, 1);
  assert.equal(checks[0]?.orderNumber, 101);
  assert.equal(checks[0]?.total, 12.5);
  assert.deepEqual(
    checks[0]?.rounds.map((round) => round.tableCheckRound),
    [1, 2],
  );
});

test("multiple legacy open orders remain separate", () => {
  const checks = groupCashierOpenOrders(
    [201, 202].map((orderNumber) => ({
      id: `order-${orderNumber}`,
      orderNumber,
      tableCheckId: null,
      tableCheckRound: null,
      tableCheck: null,
      total: 5,
      createdAt: new Date(),
      cashierName: null,
      items: [],
    })),
  );

  assert.deepEqual(
    checks.map((check) => check.orderNumber),
    [201, 202],
  );
});

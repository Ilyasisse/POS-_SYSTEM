import { expect, test } from "@jest/globals";

import {
  groupCashierOpenOrders,
  resolveTableCheckIdentity,
} from "../../src/lib/cashier/table-checks";

test("table-check identity keeps the customer number while exposing each ticket", () => {
  expect(
    resolveTableCheckIdentity({
      orderNumber: 102,
      tableCheckRound: 2,
      tableCheck: { checkNumber: 101 },
    }),
  ).toStrictEqual({ orderNumber: 101, ticketNumber: 102, roundNumber: 2 });
});

test("legacy orders retain their original customer-facing number", () => {
  expect(resolveTableCheckIdentity({ orderNumber: 99 })).toStrictEqual({
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

  expect(checks.length).toBe(1);
  expect(checks[0]?.orderNumber).toBe(101);
  expect(checks[0]?.total).toBe(12.5);
  expect(checks[0]?.rounds.map((round) => round.tableCheckRound)).toStrictEqual([1, 2]);
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

  expect(checks.map((check) => check.orderNumber)).toStrictEqual([201, 202]);
});

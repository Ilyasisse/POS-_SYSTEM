import assert from "node:assert/strict";
import test from "node:test";
import {
  closeSettledTableChecks,
  groupCashierOpenOrders,
  resolveTableCheckIdentity,
} from "../../src/lib/cashier/table-checks";
import type { Prisma } from "@prisma/client";

test("settling the final table check queues the empty table for cleaning", async () => {
  const calls: Array<{ operation: string; args: unknown }> = [];
  const tx = {
    tableCheck: {
      updateMany: async (args: unknown) => {
        calls.push({ operation: "close", args });
        return { count: 1 };
      },
      findMany: async () => [{ tableId: "table-1" }],
    },
    table: {
      updateMany: async (args: unknown) => {
        calls.push({ operation: "dirty", args });
        return { count: 1 };
      },
    },
  } as unknown as Pick<Prisma.TransactionClient, "tableCheck" | "table">;

  const closedAt = new Date("2026-09-24T12:00:00Z");
  await closeSettledTableChecks(tx, ["check-1", "check-1"], closedAt);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0]?.args, {
    where: {
      id: { in: ["check-1"] },
      closedAt: null,
      orders: { none: { status: "OPEN" } },
    },
    data: { closedAt },
  });
  assert.deepEqual(calls[1], {
    operation: "dirty",
    args: {
      where: {
        id: { in: ["table-1"] },
        needsCleaning: false,
        orders: { none: { status: "OPEN", type: "DINE_IN" } },
      },
      data: { needsCleaning: true },
    },
  });
});

test("an open check does not queue its table for cleaning", async () => {
  let markedForCleaning = false;
  const tx = {
    tableCheck: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [],
    },
    table: {
      updateMany: async () => {
        markedForCleaning = true;
        return { count: 1 };
      },
    },
  } as unknown as Pick<Prisma.TransactionClient, "tableCheck" | "table">;

  await closeSettledTableChecks(tx, ["open-check"], new Date());
  assert.equal(markedForCleaning, false);
});

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

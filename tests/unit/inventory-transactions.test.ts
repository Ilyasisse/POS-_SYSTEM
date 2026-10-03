import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";
import { Prisma } from "@prisma/client";

// Replace framework boundaries only; exercise the real actions and stock ledger.
const moduleLoader = Module as unknown as {
  _load: (id: string, ...args: unknown[]) => unknown;
};
const originalLoad = moduleLoader._load;
const database: { $transaction?: unknown } = {};
moduleLoader._load = function (id, ...args) {
  if (id === "server-only") return {};
  if (id === "@/lib/prisma") return { prisma: database };
  if (id === "@/lib/auth/require-permission") {
    return {
      requirePermission: async () => ({ id: "staff-1", role: "ADMIN" }),
    };
  }
  if (id === "@/lib/posthog-server") return { getPostHogClient: () => null };
  if (id === "next/cache") return { revalidatePath: () => undefined };
  if (id === "next/navigation") {
    return {
      redirect: (path: string) => {
        throw new Error(`redirect:${path}`);
      },
    };
  }
  return originalLoad.call(this, id, ...args);
};
const actions = import("../../src/app/inventory/actions").finally(() => {
  moduleLoader._load = originalLoad;
});

test("concurrent supply takes preserve both deductions and sequential ledger balances", async () => {
  const { takeSupplyInventory } = await actions;
  let stock = new Prisma.Decimal(10);
  let nextTransaction = 0;
  let lockOwner: number | null = null;
  let pendingLock = Promise.resolve();
  let firstMovementDone!: () => void;
  const firstMovement = new Promise<void>((resolve) => {
    firstMovementDone = resolve;
  });
  const events: Array<{
    quantityBefore: Prisma.Decimal;
    quantityAfter: Prisma.Decimal;
    quantityDelta: Prisma.Decimal;
  }> = [];

  database.$transaction = async (
    callback: (tx: unknown) => Promise<unknown>,
  ) => {
    const transactionId = ++nextTransaction;
    let releaseLock: (() => void) | undefined;
    let reads = 0;
    const tx = {
      $queryRaw: async () => {
        if (lockOwner === transactionId) return [{ id: "supply-1" }];
        const previousLock = pendingLock;
        pendingLock = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        await previousLock;
        lockOwner = transactionId;
        return [{ id: "supply-1" }];
      },
      inventorySupply: {
        findUnique: async () => {
          const snapshot = stock;
          // Reproduce a stale first read completing after the other take has written.
          // Taking the row lock before reading prevents this interleaving.
          if (
            transactionId === 2 &&
            ++reads === 1 &&
            lockOwner !== transactionId
          ) {
            await firstMovement;
          }
          return {
            id: "supply-1",
            name: "Sugar",
            unit: "g",
            stockQty: snapshot,
            lowStockThreshold: new Prisma.Decimal(1),
            inventoryAlertStatus: "OK",
            canonicalUnit: "GRAM",
            quantityCoverage: "COMPLETE",
            standardUnitCost: new Prisma.Decimal("0.01"),
          };
        },
        update: async () => ({}),
        updateMany: async ({
          data,
        }: {
          data: { stockQty: { increment: Prisma.Decimal } };
        }) => {
          if (stock.add(data.stockQty.increment).isNegative())
            return { count: 0 };
          stock = stock.add(data.stockQty.increment);
          return { count: 1 };
        },
        findUniqueOrThrow: async () => ({
          stockQty: stock,
          canonicalUnit: "GRAM",
          quantityCoverage: "COMPLETE",
          standardUnitCost: new Prisma.Decimal("0.01"),
        }),
      },
      stockEvent: {
        create: async ({ data }: { data: (typeof events)[number] }) => {
          events.push(data);
          return { ...data, id: `event-${events.length}` };
        },
      },
      inventoryMovement: {
        create: async () => {
          if (transactionId === 1) firstMovementDone();
          return {};
        },
      },
    };
    try {
      return await callback(tx);
    } finally {
      if (lockOwner === transactionId) lockOwner = null;
      releaseLock?.();
    }
  };

  const take = (quantity: string) => {
    const form = new FormData();
    form.set("supplyId", "supply-1");
    form.set("quantity", quantity);
    return takeSupplyInventory(form);
  };
  const results = await Promise.allSettled([take("2"), take("3")]);
  for (const result of results) {
    assert.equal(result.status, "rejected");
    if (result.status === "rejected")
      assert.match(
        String(result.reason),
        /redirect:\/inventory\?inventoryEmail=none/,
      );
  }
  assert.equal(stock.toString(), "5");
  assert.deepEqual(
    events.map((event) => [
      event.quantityBefore.toString(),
      event.quantityAfter.toString(),
      event.quantityDelta.toString(),
    ]),
    [
      ["10", "8", "-2"],
      ["8", "5", "-3"],
    ],
  );
});

import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";
import { getTodaySupplyDateKey } from "../../src/lib/supplies/supply-purchases";

const moduleLoader = Module as unknown as {
  _load: (id: string, ...args: unknown[]) => unknown;
};
const originalLoad = moduleLoader._load;
const database: {
  $transaction?: unknown;
  supplyPurchase?: unknown;
  supplyCatalogItem?: unknown;
} = {};
moduleLoader._load = function (id, ...args) {
  if (id === "@/lib/prisma") return { prisma: database };
  if (id === "@/lib/auth/require-permission") {
    return { requirePermission: async () => ({ id: "staff-1" }) };
  }
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
const actions =
  import("../../src/app/admin/(operations)/supplies/actions").finally(() => {
    moduleLoader._load = originalLoad;
  });

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

for (const action of [
  "updateSupplyPurchase",
  "deleteSupplyPurchase",
] as const) {
  test(`${action} rejects a source day closed after the initial request`, async () => {
    const handlers = await actions;
    let writes = 0;
    const write = async () => {
      writes++;
      return { count: 1 };
    };
    // The request's initial snapshot was open, but the actual transaction sees
    // the source day already closed. Moving to an open target cannot bypass it.
    database.supplyPurchase = {
      findUnique: async () => ({ day: { closedAt: null } }),
      deleteMany: write,
    };
    database.supplyCatalogItem = {
      findFirst: async () => ({ id: "catalog-1", name: "Milk", unit: "l" }),
    };
    database.$transaction = (callback: (tx: unknown) => unknown) =>
      callback({
        supplyPurchase: {
          findUnique: async () => ({ day: { closedAt: new Date() } }),
          update: write,
          deleteMany: write,
        },
        supplyDay: { upsert: async () => ({ closedAt: null }) },
      });
    await assert.rejects(
      handlers[action](
        form({
          id: "entry-1",
          catalogItemId: "catalog-1",
          purchaseDate: getTodaySupplyDateKey(),
          returnDate: getTodaySupplyDateKey(),
          quantity: "1",
          unitPrice: "2",
        }),
      ),
      /Reopen this supply day before/,
    );
    assert.equal(writes, 0);
  });
}

for (const action of ["closeSupplyDay", "reopenSupplyDay"] as const) {
  for (const invalidDate of ["not-a-date", "2999-01-01"]) {
    test(`${action} rejects ${invalidDate} without changing today's day`, async () => {
      const handlers = await actions;
      let writes = 0;
      const write = async () => {
        writes++;
        return {};
      };
      database.$transaction = (callback: (tx: unknown) => unknown) =>
        callback({
          supplyPurchase: {
            findMany: async () => [{ quantity: "1", unitPrice: "2" }],
          },
          supplyDay: {
            findUnique: async () => ({
              id: "day-1",
              closedAt: new Date(),
              _count: { payments: 0 },
            }),
            update: write,
            upsert: write,
          },
        });
      await assert.rejects(
        handlers[action](form({ date: invalidDate })),
        /supplyStatus=invalid_date/,
      );
      assert.equal(writes, 0);
    });
  }
}

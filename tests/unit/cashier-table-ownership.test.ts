import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  lockCashierTable,
  TableOwnershipError,
} from "../../src/lib/cashier/table-ownership";

function tableTransaction() {
  const table = { isActive: true, ownerCashierId: null as string | null };
  const tx = {
    $queryRaw: async () => [{ id: "table-1" }],
    order: { findFirst: async () => null },
    table: {
      findUnique: async () => ({ ...table }),
      update: async ({ data }: { data: { ownerCashierId: string } }) => {
        table.ownerCashierId = data.ownerCashierId;
        return { ...table };
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { table, tx };
}

test("the first cashier claims a table and another cashier cannot use it", async () => {
  const { table, tx } = tableTransaction();
  await lockCashierTable(tx, "table-1", { id: "first", role: "CASHIER" }, true);
  assert.equal(table.ownerCashierId, "first");

  await assert.rejects(
    lockCashierTable(tx, "table-1", { id: "second", role: "CASHIER" }, true),
    (error: unknown) =>
      error instanceof TableOwnershipError && error.status === 409,
  );
  assert.equal(table.ownerCashierId, "first");

  await lockCashierTable(
    tx,
    "table-1",
    { id: "manager", role: "MANAGER" },
    false,
  );
  assert.equal(table.ownerCashierId, "first");
  await lockCashierTable(
    tx,
    "table-1",
    { id: "manager", role: "MANAGER" },
    true,
  );
  assert.equal(table.ownerCashierId, "first");
});

test("unowned occupied tables require manager intervention", async () => {
  const { table, tx } = tableTransaction();
  tx.order.findFirst = async () => ({ id: "legacy-order" }) as never;
  await assert.rejects(
    lockCashierTable(tx, "table-1", { id: "cashier", role: "CASHIER" }, true),
    (error: unknown) =>
      error instanceof TableOwnershipError && error.status === 409,
  );
  assert.equal(table.ownerCashierId, null);
  await lockCashierTable(
    tx,
    "table-1",
    { id: "manager", role: "MANAGER" },
    true,
  );
  assert.equal(table.ownerCashierId, null);
});

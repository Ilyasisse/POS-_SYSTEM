import { expect, afterAll, test } from "@jest/globals";

import { appendStockEvent, createRecipeVersion } from "../../src/lib/inventory/stock-ledger";
import { prisma } from "../../src/lib/prisma";
import { client, db, json, product, table, unique, user } from "../workflow/fixtures";

afterAll(async () => {
  await Promise.all([db.$disconnect(), prisma.$disconnect()]);
});

test("a recipe sale deducts ingredients once when it enters the kitchen", async () => {
  const [item, cashier, diningTable, supply] = await Promise.all([
    product(),
    user("CASHIER"),
    table(),
    db.inventorySupply.create({
      data: {
        name: unique("Flour"),
        unit: "g",
        canonicalUnit: "GRAM",
        quantityCoverage: "COMPLETE",
        stockQty: 1000,
        standardUnitCost: "0.01",
      },
    }),
  ]);
  await createRecipeVersion({
    productId: item.id,
    effectiveFrom: new Date(Date.now() - 3_600_000),
    yieldQuantity: 2,
    createdByUserId: cashier.id,
    ingredients: [{ supplyId: supply.id, quantity: 100 }],
  });
  const api = await client(cashier);
  const { order } = await json<{ order: { id: string } }>(
    await api("/api/orders/table", {
      body: { tableId: diningTable.id, items: [{ productId: item.id, qty: 3 }] },
    }),
  );
  await json(await api("/api/orders/pay", { body: { orderId: order.id, paymentMethod: "OTHER" } }));
  const events = await db.stockEvent.findMany({ where: { supplyId: supply.id } });
  expect(
    events.map(({ quantityDelta, quantityAfter }) => [
      Number(quantityDelta),
      Number(quantityAfter),
    ]),
  ).toStrictEqual([[-150, 850]]);
  expect(await db.stockEvent.count({ where: { productId: item.id } })).toBe(0);
  await expect(db.stockEvent.delete({ where: { id: events[0].id } })).rejects.toThrow(
    /append-only/,
  );
});

test("concurrent withdrawals cannot overspend supply stock or leave a partial event", async () => {
  const supply = await db.inventorySupply.create({
    data: {
      name: unique("Test supply"),
      stockQty: 10,
      canonicalUnit: "PIECE",
      quantityCoverage: "COMPLETE",
    },
  });
  const take = (quantity: number) =>
    db.$transaction((tx) =>
      appendStockEvent(tx, {
        supplyId: supply.id,
        type: "MANUAL_USAGE",
        quantityDelta: -quantity,
        reason: "Workflow test withdrawal",
      }),
    );
  await expect(take(11)).rejects.toThrow(/Insufficient inventory/);
  expect(await db.stockEvent.count({ where: { supplyId: supply.id } })).toBe(0);
  const attempts = await Promise.allSettled([take(6), take(6)]);
  expect(attempts.filter((attempt) => attempt.status === "fulfilled").length).toBe(1);
  const [event] = await db.stockEvent.findMany({ where: { supplyId: supply.id } });
  expect(Number(event.quantityAfter)).toBe(4);
  expect(
    Number((await db.inventorySupply.findUniqueOrThrow({ where: { id: supply.id } })).stockQty),
  ).toBe(4);
});

import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";
import { Prisma } from "@prisma/client";

const moduleLoader = Module as unknown as {
  _load: (id: string, ...args: unknown[]) => unknown;
};
const originalLoad = moduleLoader._load;
moduleLoader._load = function (id, ...args) {
  if (id === "server-only") return {};
  if (id === "@/lib/prisma") return { prisma: {} };
  return originalLoad.call(this, id, ...args);
};
const ledger = import("../../src/lib/inventory/stock-ledger").finally(() => {
  moduleLoader._load = originalLoad;
});

function fixture() {
  const recipes = [
    {
      id: "old-recipe",
      productId: "product-1",
      isActive: false,
      effectiveFrom: new Date("2025-01-01"),
      effectiveTo: new Date("2025-02-01"),
      yieldQuantity: new Prisma.Decimal(2),
      ingredients: [
        { supplyId: "old-ingredient", quantity: new Prisma.Decimal(10) },
      ],
    },
    {
      id: "new-recipe",
      productId: "product-1",
      isActive: true,
      effectiveFrom: new Date("2025-02-01"),
      effectiveTo: null,
      yieldQuantity: new Prisma.Decimal(1),
      ingredients: [
        { supplyId: "new-ingredient", quantity: new Prisma.Decimal(20) },
      ],
    },
    {
      id: "foreign-recipe",
      productId: "other-product",
      isActive: true,
      effectiveFrom: new Date("2025-02-01"),
      effectiveTo: null,
      yieldQuantity: new Prisma.Decimal(1),
      ingredients: [
        { supplyId: "other-ingredient", quantity: new Prisma.Decimal(1) },
      ],
    },
  ];
  const stock = new Map(
    ["product-1", "old-ingredient", "new-ingredient", "other-ingredient"].map(
      (id) => [id, new Prisma.Decimal(100)],
    ),
  );
  const events: Array<{
    supplyId: string | null;
    productId: string | null;
    quantityDelta: Prisma.Decimal;
  }> = [];
  const updateMany = async ({
    where,
    data,
  }: {
    where: { id: string };
    data: { stockQty: { increment: Prisma.Decimal } };
  }) => {
    stock.set(where.id, stock.get(where.id)!.add(data.stockQty.increment));
    return { count: 1 };
  };
  const tx = {
    product: {
      findMany: async () => [
        {
          id: "product-1",
          name: "Meal",
          trackStock: true,
          recipeVersions: [recipes[1]],
        },
      ],
      updateMany,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        stockQty: stock.get(where.id),
        canonicalUnit: "PIECE",
        cost: new Prisma.Decimal(1),
        quantityCoverage: "COMPLETE",
      }),
    },
    recipeVersion: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        recipes.filter((recipe) => where.id.in.includes(recipe.id)),
    },
    inventorySupply: {
      updateMany,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        stockQty: stock.get(where.id),
        canonicalUnit: "GRAM",
        standardUnitCost: new Prisma.Decimal(1),
        quantityCoverage: "COMPLETE",
      }),
    },
    stockEvent: {
      create: async ({ data }: { data: (typeof events)[number] }) => {
        events.push(data);
        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, events, stock };
}

test("a delayed customer payment consumes its expired recipe snapshot instead of the new active recipe", async () => {
  const { deductSaleInventory } = await ledger;
  const { tx, events, stock } = fixture();
  await deductSaleInventory(
    tx,
    [{ productId: "product-1", qty: 2, recipeVersionId: "old-recipe" }],
    "order-1",
  );
  assert.equal(events[0]?.supplyId, "old-ingredient");
  assert.equal(events[0]?.quantityDelta.toString(), "-10");
  assert.equal(stock.get("new-ingredient")?.toString(), "100");
});

test("null snapshots keep finished-item stock deduction while absent snapshots use the current recipe", async () => {
  const { deductSaleInventory } = await ledger;
  const { tx, events } = fixture();
  await deductSaleInventory(
    tx,
    [
      { productId: "product-1", qty: 1, recipeVersionId: null },
      { productId: "product-1", qty: 1 },
    ],
    "order-1",
  );
  assert.deepEqual(
    events.map((event) => [
      event.productId,
      event.supplyId,
      event.quantityDelta.toString(),
    ]),
    [
      ["product-1", null, "-1"],
      [null, "new-ingredient", "-20"],
    ],
  );
});

test("sale lines for the same product aggregate only when their recipe snapshots match", async () => {
  const { deductSaleInventory } = await ledger;
  const { tx, events } = fixture();
  await deductSaleInventory(
    tx,
    [
      { productId: "product-1", qty: 1, recipeVersionId: "old-recipe" },
      { productId: "product-1", qty: 2, recipeVersionId: "old-recipe" },
      { productId: "product-1", qty: 1, recipeVersionId: "new-recipe" },
    ],
    "order-1",
  );
  assert.deepEqual(
    events.map((event) => [event.supplyId, event.quantityDelta.toString()]),
    [
      ["old-ingredient", "-15"],
      ["new-ingredient", "-20"],
    ],
  );
});

for (const recipeVersionId of ["foreign-recipe", "missing-recipe"]) {
  test(`rejects ${recipeVersionId} before changing inventory`, async () => {
    const { deductSaleInventory } = await ledger;
    const { tx, events } = fixture();
    await assert.rejects(
      deductSaleInventory(
        tx,
        [{ productId: "product-1", qty: 1, recipeVersionId }],
        "order-1",
      ),
      /snapshotted recipe does not belong/,
    );
    assert.equal(events.length, 0);
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import { classifyMenuProducts } from "../../src/lib/reports/menu-engineering";

test("classifies products by sold quantity and unit contribution", () => {
  const result = classifyMenuProducts([
    {
      id: "a",
      name: "Popular profitable",
      quantity: 20,
      grossSales: "120.00",
      grossProfit: "100.00",
    },
    {
      id: "b",
      name: "Rare profitable",
      quantity: 2,
      grossSales: "16.00",
      grossProfit: "10.00",
    },
    {
      id: "c",
      name: "Popular low",
      quantity: 20,
      grossSales: "60.00",
      grossProfit: "20.00",
    },
    {
      id: "d",
      name: "Rare low",
      quantity: 2,
      grossSales: "4.00",
      grossProfit: "2.00",
    },
  ]);
  assert.deepEqual(
    result.rows.map((row) => row.category),
    ["Star", "Puzzle", "Workhorse", "Review"],
  );
  assert.equal(result.popularityAverage, 11);
  assert.equal(result.unitProfitAverage, 3);
});

test("omits missing-cost products without overstating coverage", () => {
  const result = classifyMenuProducts([
    {
      id: "a",
      name: "Costed",
      quantity: 5,
      grossSales: "10.00",
      grossProfit: "4.00",
    },
    {
      id: "b",
      name: "Unknown cost",
      quantity: 10,
      grossSales: "20.00",
      grossProfit: null,
    },
  ]);
  assert.equal(result.excluded, 1);
  assert.equal(result.popularityAverage, 7.5);
  assert.equal(result.rows.length, 1);
});

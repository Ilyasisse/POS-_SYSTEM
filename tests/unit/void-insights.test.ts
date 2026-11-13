import assert from "node:assert/strict";
import test from "node:test";
import { summarizeVoidInsights } from "../../src/lib/reports/void-insights";

test("counts each voided order once per product while totaling line quantities", () => {
  const result = summarizeVoidInsights([
    {
      orderItems: [
        { productId: "coffee", productName: "Coffee", qty: 2 },
        { productId: "coffee", productName: "Coffee", qty: 1 },
        { productId: "cake", productName: "Cake", qty: 1 },
      ],
      salesAdjustments: [{ reason: "Wrong order" }],
    },
    {
      orderItems: [{ productId: "coffee", productName: "Coffee", qty: 1 }],
      salesAdjustments: [{ reason: " Wrong order " }],
    },
  ]);
  assert.equal(result.totalOrders, 2);
  assert.deepEqual(result.products, [
    { id: "coffee", name: "Coffee", orders: 2, quantity: 4 },
    { id: "cake", name: "Cake", orders: 1, quantity: 1 },
  ]);
  assert.deepEqual(result.reasons, [{ reason: "Wrong order", count: 2 }]);
});

test("returns empty breakdowns when there are no voided orders", () => {
  assert.deepEqual(summarizeVoidInsights([]), {
    totalOrders: 0,
    products: [],
    reasons: [],
  });
});

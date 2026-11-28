import assert from "node:assert/strict";
import test from "node:test";
import { summarizeProductDiscounts } from "../../src/lib/reports/product-discounts";

test("attributes item discounts by product, not whole-order discounts", () => {
  const result = summarizeProductDiscounts([
    { id: "o1", orderItems: [{ id: "i1", productId: "burger", productName: "Burger" }], salesAdjustments: [
      { type: "DISCOUNT", orderItemId: "i1", amount: "0.10" },
      { type: "DISCOUNT", orderItemId: "i1", amount: "0.20" },
      { type: "DISCOUNT", orderItemId: null, amount: "1.00" },
      { type: "REFUND", orderItemId: "i1", amount: "2.00" },
    ] },
    { id: "o2", orderItems: [{ id: "i2", productId: "burger", productName: "Burger" }], salesAdjustments: [
      { type: "DISCOUNT", orderItemId: "i2", amount: "0.70" },
    ] },
  ]);
  assert.deepEqual(result.products, [{ productId: "burger", name: "Burger", adjustments: 3, orders: 2, soldOrders: 2, discountedOrderRate: "100.0", amount: "1.00" }]);
  assert.deepEqual(result.unattributed, { adjustments: 1, orders: 1, amount: "1.00" });
});

test("does not assign a missing item reference to another item", () => {
  const result = summarizeProductDiscounts([{ id: "o1", orderItems: [
    { id: "i1", productId: "a", productName: "Tea" },
  ], salesAdjustments: [{ type: "DISCOUNT", orderItemId: "missing", amount: "0.50" }] }]);
  assert.deepEqual(result.products, []);
  assert.equal(result.unattributed.amount, "0.50");
});

test("returns empty money-safe totals", () => {
  assert.deepEqual(summarizeProductDiscounts([]), {
    products: [], unattributed: { adjustments: 0, orders: 0, amount: "0.00" },
  });
});

test("rate uses distinct paid orders, not the number of item lines", () => {
  const result = summarizeProductDiscounts([
    { id: "o1", orderItems: [{ id: "a", productId: "tea", productName: "Tea" }, { id: "b", productId: "tea", productName: "Tea" }], salesAdjustments: [{ type: "DISCOUNT", orderItemId: "a", amount: "0.25" }] },
    { id: "o2", orderItems: [{ id: "c", productId: "tea", productName: "Tea" }], salesAdjustments: [] },
  ]);
  assert.equal(result.products[0]?.soldOrders, 2);
  assert.equal(result.products[0]?.discountedOrderRate, "50.0");
});

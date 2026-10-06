import assert from "node:assert/strict";
import test from "node:test";
import { summarizeRefundInsights } from "../../src/lib/reports/refund-insights";

test("deduplicates refunded orders per product and keeps unlinked money separate", () => {
  const report = summarizeRefundInsights([
    {
      orderId: "a",
      orderItem: { productId: "coffee", productName: "Coffee" },
      amount: "1.05",
    },
    {
      orderId: "a",
      orderItem: { productId: "coffee", productName: "Coffee" },
      amount: "0.10",
    },
    {
      orderId: "b",
      orderItem: { productId: "coffee", productName: "Coffee" },
      amount: "2.00",
    },
    { orderId: "b", orderItem: null, amount: "5.25" },
  ]);
  assert.deepEqual(report, {
    totalAdjustments: 4,
    unallocatedAdjustments: 1,
    unallocatedAmount: "5.25",
    products: [
      {
        id: "coffee",
        name: "Coffee",
        refundedOrders: 2,
        adjustments: 3,
        amount: "3.15",
      },
    ],
  });
});

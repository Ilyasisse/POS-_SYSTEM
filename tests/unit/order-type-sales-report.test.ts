import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateOrderTypeMetrics } from "../../src/lib/reports/order-type-metrics";

test("reports sales, adjustments, average value, and share by order type", () => {
  const rows = calculateOrderTypeMetrics([
    {
      type: "DINE_IN",
      orderItems: [{ lineTotal: "10.00" }, { lineTotal: "5.00" }],
      salesAdjustments: [{ type: "DISCOUNT", amount: "3.00" }],
    },
    {
      type: "DINE_IN",
      orderItems: [{ lineTotal: "8.00" }],
      salesAdjustments: [],
    },
    {
      type: "TAKEOUT",
      orderItems: [{ lineTotal: "5.00" }],
      salesAdjustments: [],
    },
  ]);

  assert.deepEqual(rows, [
    {
      type: "DINE_IN",
      label: "Dine-in",
      orderCount: 2,
      grossSales: "23.00",
      reductions: "3.00",
      netSales: "20.00",
      averageOrderValue: "10.00",
      netSalesSharePercent: 80,
    },
    {
      type: "TAKEOUT",
      label: "Takeaway",
      orderCount: 1,
      grossSales: "5.00",
      reductions: "0.00",
      netSales: "5.00",
      averageOrderValue: "5.00",
      netSalesSharePercent: 20,
    },
    {
      type: "DELIVERY",
      label: "Delivery",
      orderCount: 0,
      grossSales: "0.00",
      reductions: "0.00",
      netSales: "0.00",
      averageOrderValue: null,
      netSalesSharePercent: 0,
    },
  ]);
});

test("uses integer cents for fractional currency inputs", () => {
  const [dineIn] = calculateOrderTypeMetrics([
    {
      type: "DINE_IN",
      orderItems: [{ lineTotal: 0.1 }, { lineTotal: 0.2 }],
      salesAdjustments: [],
    },
  ]);

  assert.equal(dineIn?.grossSales, "0.30");
});

test("authorized report endpoint and business-intelligence link are present", async () => {
  const [route, page] = await Promise.all([
    readFile(
      new URL("../../src/app/api/admin/reports/order-types/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../src/app/admin/business-intelligence/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(route, /authorizeApi\(PERMISSIONS\.REPORT_DAILY_VIEW\)/);
  assert.match(route, /reportQuerySchema\.safeParse/);
  assert.match(page, /\/api\/admin\/reports\/order-types/);
});

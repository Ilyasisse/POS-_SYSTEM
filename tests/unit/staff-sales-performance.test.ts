import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateStaffSalesMetrics } from "../../src/lib/reports/staff-sales-metrics";

test("credits a sale to the waiter before the cashier", () => {
  const rows = calculateStaffSalesMetrics([
    {
      waiter: { id: "waiter-1", fullName: "Amina" },
      cashier: { id: "cashier-1", fullName: "Bilal" },
      orderItems: [{ lineTotal: "12.00" }],
      salesAdjustments: [{ amount: "2.00" }],
    },
  ]);

  assert.deepEqual(rows, [
    {
      staffId: "waiter-1",
      staffName: "Amina",
      attribution: "WAITER",
      orderCount: 1,
      grossSales: "12.00",
      reductions: "2.00",
      netSales: "10.00",
      averageOrderValue: "10.00",
    },
  ]);
});

test("uses cashier fallback, groups staff, and ranks by net sales", () => {
  const rows = calculateStaffSalesMetrics([
    {
      waiter: null,
      cashier: { id: "cashier-1", fullName: "Bilal" },
      orderItems: [{ lineTotal: 5 }],
      salesAdjustments: [],
    },
    {
      waiter: null,
      cashier: { id: "cashier-1", fullName: "Bilal" },
      orderItems: [{ lineTotal: 7 }],
      salesAdjustments: [],
    },
    {
      waiter: { id: "waiter-1", fullName: "Amina" },
      cashier: null,
      orderItems: [{ lineTotal: 20 }],
      salesAdjustments: [{ amount: 1 }],
    },
  ]);

  assert.equal(rows[0]?.staffName, "Amina");
  assert.equal(rows[0]?.netSales, "19.00");
  assert.equal(rows[1]?.staffName, "Bilal");
  assert.equal(rows[1]?.orderCount, 2);
  assert.equal(rows[1]?.averageOrderValue, "6.00");
});

test("keeps unattributed paid orders visible", () => {
  const [row] = calculateStaffSalesMetrics([
    {
      waiter: null,
      cashier: null,
      orderItems: [{ lineTotal: "3.50" }],
      salesAdjustments: [],
    },
  ]);

  assert.equal(row?.attribution, "UNASSIGNED");
  assert.equal(row?.staffId, null);
  assert.equal(row?.netSales, "3.50");
});

test("staff-sales endpoint is permission protected and discoverable", async () => {
  const [route, page] = await Promise.all([
    readFile(
      new URL("../../src/app/api/admin/reports/staff-sales/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../src/app/admin/business-intelligence/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(route, /authorizeApi\(PERMISSIONS\.REPORT_STAFF_VIEW\)/);
  assert.match(route, /reportQuerySchema\.safeParse/);
  assert.match(page, /\/api\/admin\/reports\/staff-sales/);
});

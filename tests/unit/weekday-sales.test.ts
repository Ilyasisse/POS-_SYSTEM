import assert from "node:assert/strict";
import test from "node:test";
import { summarizeWeekdaySales } from "../../src/lib/reports/weekday-sales";

test("returns all weekdays in order, including zero-sales days", () => {
  const rows = summarizeWeekdaySales([]);
  assert.equal(rows.length, 7);
  assert.equal(rows[0]?.day, "Monday");
  assert.equal(rows[6]?.day, "Sunday");
  assert.ok(rows.every((row) => row.netSales === "0.00" && row.paidOrders === 0 && row.averageOrderValue === null));
});

test("uses the local completion weekday across the UTC midnight boundary", () => {
  const rows = summarizeWeekdaySales([
    { closedAt: new Date("2026-09-13T21:30:00Z"), netSales: "0.10" },
    { closedAt: new Date("2026-09-14T10:00:00Z"), netSales: "0.20" },
    { closedAt: new Date("2026-09-13T20:30:00Z"), netSales: "7.00" },
  ]);
  assert.deepEqual(rows[0], { day: "Monday", paidOrders: 2, netSales: "0.30", averageOrderValue: "0.15" });
  assert.equal(rows[6]?.netSales, "7.00");
});

test("retains reductions and negative net totals without clamping", () => {
  const rows = summarizeWeekdaySales([
    { closedAt: new Date("2026-09-14T10:00:00Z"), netSales: "-2.50" },
  ]);
  assert.equal(rows[0]?.netSales, "-2.50");
  assert.equal(rows[0]?.averageOrderValue, "-2.50");
});

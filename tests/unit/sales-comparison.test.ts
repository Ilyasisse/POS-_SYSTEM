import assert from "node:assert/strict";
import test from "node:test";
import { compareSalesSummaries, comparisonMonthRange, comparisonMonthSchema, defaultComparisonMonths } from "../../src/lib/reports/sales-comparison";

test("defaults to two completed café business months, including the new-year boundary", () => {
  assert.deepEqual(defaultComparisonMonths(new Date("2026-01-15T12:00:00Z")), { month: "2025-12", baseline: "2025-11" });
  for (const time of ["01:00:00", "03:59:59"]) {
    assert.deepEqual(defaultComparisonMonths(new Date(`2026-09-01T${time}Z`)), { month: "2026-07", baseline: "2026-06" });
  }
  assert.deepEqual(defaultComparisonMonths(new Date("2026-09-01T04:00:00Z")), { month: "2026-08", baseline: "2026-07" });
});

test("month ranges use café 7 AM boundaries and handle leap years", () => {
  const range = comparisonMonthRange("2024-02");
  assert.equal(range.start.toISOString(), "2024-02-01T04:00:00.000Z");
  assert.equal(range.end.toISOString(), "2024-03-01T04:00:00.000Z");
  assert.equal((range.end.getTime() - range.start.getTime()) / 86_400_000, 29);
  for (const value of ["2026-13", "2026-1", "bad", "1900-01"]) assert.equal(comparisonMonthSchema.safeParse(value).success, false);
});

test("calculates exact money differences and signed percentage changes", () => {
  const rows = compareSalesSummaries({ netSales: "0.30", paidOrders: 3, averageOrderValue: "0.10" }, { netSales: "0.20", paidOrders: 4, averageOrderValue: "0.05" });
  assert.equal(rows[0].delta, "0.10");
  assert.equal(rows[0].percent, "50.00");
  assert.equal(rows[1].delta, "-1");
  assert.equal(rows[1].percent, "-25.00");
  assert.equal(rows[2].percent, "100.00");
});

test("does not invent growth percentages or average spend for empty and negative baselines", () => {
  const current = { netSales: "10.00", paidOrders: 1, averageOrderValue: "10.00" };
  const empty = compareSalesSummaries(current, { netSales: "0.00", paidOrders: 0, averageOrderValue: null });
  assert.ok(empty.every((row) => row.percent === null));
  assert.equal(empty[2].delta, null);
  assert.equal(compareSalesSummaries(current, { ...current, netSales: "-5.00" })[0].percent, null);
});

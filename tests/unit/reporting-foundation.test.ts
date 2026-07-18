import assert from "node:assert/strict";
import test from "node:test";
import {
  getBusinessDayRange,
  getBusinessDateRange,
  getComparisonRanges,
  getReportingMonthRange,
  getReportingWeekRange,
  parseBusinessDate,
} from "../../src/lib/reports/reporting-calendar";
import {
  averageOrderValue,
  breakEvenSales,
  expectedStock,
  grossProfit,
  netProfit,
  netSales,
  ratioPercent,
  settlementVariance,
} from "../../src/lib/reports/financial-formulas";
import { reportQuerySchema } from "../../src/lib/reports/validation";

test("uses the Nairobi 7 AM to 5 AM next-day business window", () => {
  const range = getBusinessDayRange(new Date("2026-07-18T10:00:00.000Z"));
  assert.equal(range.start.toISOString(), "2026-07-18T04:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-19T02:00:00.000Z");
});

test("assigns after-midnight sales to the prior business date", () => {
  const range = getBusinessDayRange(new Date("2026-07-18T00:00:00.000Z"));
  assert.equal(range.start.toISOString(), "2026-07-17T04:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-18T02:00:00.000Z");
});

test("validates business dates and builds Saturday reporting weeks", () => {
  assert.deepEqual(parseBusinessDate("2026-02-29"), null);
  assert.ok(getBusinessDateRange("2026-07-18"));
  const week = getReportingWeekRange(new Date("2026-07-24T12:00:00.000Z"));
  assert.equal(week.start.toISOString(), "2026-07-18T04:00:00.000Z");
  assert.equal(week.end.toISOString(), "2026-07-25T02:00:00.000Z");
});

test("uses calendar-month business-date boundaries", () => {
  const month = getReportingMonthRange(new Date("2026-07-18T12:00:00.000Z"));
  assert.equal(month.start.toISOString(), "2026-07-01T04:00:00.000Z");
  assert.equal(month.end.toISOString(), "2026-08-01T04:00:00.000Z");
});

test("provides yesterday and same-weekday comparisons", () => {
  const ranges = getComparisonRanges(new Date("2026-07-18T12:00:00.000Z"));
  assert.equal(ranges.yesterday.start.toISOString(), "2026-07-17T04:00:00.000Z");
  assert.equal(ranges.sameWeekdayLastWeek.start.toISOString(), "2026-07-11T04:00:00.000Z");
});

test("calculates financial values with Decimal precision", () => {
  const net = netSales("10.10", "0.10", "1.00");
  assert.equal(net.toFixed(2), "9.00");
  assert.equal(grossProfit(net, "3.25").toFixed(2), "5.75");
  assert.equal(averageOrderValue(net, 3)?.toFixed(2), "3.00");
  assert.equal(settlementVariance("11", "10.25").toFixed(2), "0.75");
  assert.equal(netProfit({ netSales: "100", cogs: "30", labour: "20", operatingExpenses: "10" }).toFixed(2), "40.00");
});

test("protects ratios and break-even calculations from zero", () => {
  assert.equal(ratioPercent(10, 0), null);
  assert.equal(averageOrderValue(10, 0), null);
  assert.equal(breakEvenSales(100, 0), null);
  assert.equal(ratioPercent(1, 4)?.toFixed(2), "25.00");
  assert.equal(breakEvenSales(100, "0.25")?.toFixed(2), "400.00");
});

test("calculates expected stock without floating-point drift", () => {
  const value = expectedStock({ opening: "10.100", received: "2.200", usage: "1.050", waste: "0.250", adjustments: "0.100" });
  assert.equal(value.toFixed(3), "11.100");
});

test("validates pagination and custom report ranges", () => {
  assert.equal(reportQuerySchema.parse({}).pageSize, 25);
  assert.equal(reportQuerySchema.safeParse({ preset: "custom", from: "2026-07-19", to: "2026-07-18" }).success, false);
  assert.equal(reportQuerySchema.safeParse({ pageSize: 101 }).success, false);
});

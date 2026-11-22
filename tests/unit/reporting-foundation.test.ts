import { expect, test } from "@jest/globals";

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
  expect(range.start.toISOString()).toBe("2026-07-18T04:00:00.000Z");
  expect(range.end.toISOString()).toBe("2026-07-19T02:00:00.000Z");
});

test("assigns after-midnight sales to the prior business date", () => {
  const range = getBusinessDayRange(new Date("2026-07-18T00:00:00.000Z"));
  expect(range.start.toISOString()).toBe("2026-07-17T04:00:00.000Z");
  expect(range.end.toISOString()).toBe("2026-07-18T02:00:00.000Z");
});

test("validates business dates and builds Saturday reporting weeks", () => {
  expect(parseBusinessDate("2026-02-29")).toStrictEqual(null);
  expect(getBusinessDateRange("2026-07-18")).toBeTruthy();
  const week = getReportingWeekRange(new Date("2026-07-24T12:00:00.000Z"));
  expect(week.start.toISOString()).toBe("2026-07-18T04:00:00.000Z");
  expect(week.end.toISOString()).toBe("2026-07-25T02:00:00.000Z");
});

test("uses calendar-month business-date boundaries", () => {
  const month = getReportingMonthRange(new Date("2026-07-18T12:00:00.000Z"));
  expect(month.start.toISOString()).toBe("2026-07-01T04:00:00.000Z");
  expect(month.end.toISOString()).toBe("2026-08-01T04:00:00.000Z");
});

test("provides yesterday and same-weekday comparisons", () => {
  const ranges = getComparisonRanges(new Date("2026-07-18T12:00:00.000Z"));
  expect(ranges.yesterday.start.toISOString()).toBe("2026-07-17T04:00:00.000Z");
  expect(ranges.sameWeekdayLastWeek.start.toISOString()).toBe("2026-07-11T04:00:00.000Z");
});

test("calculates financial values with Decimal precision", () => {
  const net = netSales("10.10", "0.10", "1.00");
  expect(net.toFixed(2)).toBe("9.00");
  expect(grossProfit(net, "3.25").toFixed(2)).toBe("5.75");
  expect(averageOrderValue(net, 3)?.toFixed(2)).toBe("3.00");
  expect(settlementVariance("11", "10.25").toFixed(2)).toBe("0.75");
  expect(
    netProfit({
      netSales: "100",
      cogs: "30",
      labour: "20",
      operatingExpenses: "10",
    }).toFixed(2),
  ).toBe("40.00");
});

test("protects ratios and break-even calculations from zero", () => {
  expect(ratioPercent(10, 0)).toBe(null);
  expect(averageOrderValue(10, 0)).toBe(null);
  expect(breakEvenSales(100, 0)).toBe(null);
  expect(ratioPercent(1, 4)?.toFixed(2)).toBe("25.00");
  expect(breakEvenSales(100, "0.25")?.toFixed(2)).toBe("400.00");
});

test("calculates expected stock without floating-point drift", () => {
  const value = expectedStock({
    opening: "10.100",
    received: "2.200",
    usage: "1.050",
    waste: "0.250",
    adjustments: "0.100",
  });
  expect(value.toFixed(3)).toBe("11.100");
});

test("validates pagination and custom report ranges", () => {
  expect(reportQuerySchema.parse({}).pageSize).toBe(25);
  expect(
    reportQuerySchema.safeParse({
      preset: "custom",
      from: "2026-07-19",
      to: "2026-07-18",
    }).success,
  ).toBe(false);
  expect(reportQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
});

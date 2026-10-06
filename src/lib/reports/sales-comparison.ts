import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getReportingMonthRange, formatBusinessDate, BUSINESS_DAY_START_MINUTE, CAFE_UTC_OFFSET_MINUTES } from "./reporting-calendar";

export const comparisonMonthSchema = z.string().regex(/^(20\d{2})-(0[1-9]|1[0-2])$/, "Choose a month between 2000 and 2099.");

export function comparisonMonthRange(month: string) {
  const valid = comparisonMonthSchema.parse(month);
  return getReportingMonthRange(new Date(`${valid}-15T12:00:00.000Z`));
}

export function defaultComparisonMonths(now = new Date()) {
  const monthClock = new Date(now.getTime() - (BUSINESS_DAY_START_MINUTE - CAFE_UTC_OFFSET_MINUTES) * 60_000);
  const current = comparisonMonthRange(monthClock.toISOString().slice(0, 7));
  const latest = getReportingMonthRange(new Date(current.start.getTime() - 86_400_000));
  const previous = getReportingMonthRange(new Date(latest.start.getTime() - 86_400_000));
  return { month: formatBusinessDate(latest.start).slice(0, 7), baseline: formatBusinessDate(previous.start).slice(0, 7) };
}

type Summary = { netSales: string; paidOrders: number; averageOrderValue: string | null };

export function compareSalesSummaries(current: Summary, baseline: Summary) {
  const metrics = [
    { label: "Net sales", value: current.netSales, baseline: baseline.netSales, money: true },
    { label: "Paid orders", value: String(current.paidOrders), baseline: String(baseline.paidOrders), money: false },
    { label: "Average order value", value: current.averageOrderValue, baseline: baseline.averageOrderValue, money: true },
  ];
  return metrics.map((metric) => {
    const value = metric.value == null ? null : new Prisma.Decimal(metric.value);
    const before = metric.baseline == null ? null : new Prisma.Decimal(metric.baseline);
    const delta = value != null && before != null ? value.minus(before) : null;
    return { ...metric, delta: delta?.toFixed(metric.money ? 2 : 0) ?? null,
      percent: delta != null && before?.greaterThan(0) ? delta.dividedBy(before).times(100).toFixed(2) : null };
  });
}

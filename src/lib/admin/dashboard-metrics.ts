import { Prisma } from "@prisma/client";
import { sumMoney, type DecimalInput } from "@/lib/reports/financial-formulas";
import {
  getBusinessDayRange,
  getReportingWeekRange,
  shiftRange,
} from "@/lib/reports/reporting-calendar";

export function dashboardRange(period: string | undefined, now: Date) {
  return period === "week" ? getReportingWeekRange(now) : getBusinessDayRange(now);
}

export function outstandingBalance(
  orders: readonly { total: DecimalInput; payments: readonly { amountPaid: DecimalInput }[] }[],
) {
  return sumMoney(
    orders.map((order) =>
      Prisma.Decimal.max(
        0,
        new Prisma.Decimal(order.total).minus(sumMoney(order.payments.map((p) => p.amountPaid))),
      ),
    ),
  );
}

export function paymentChart(
  payments: readonly { createdAt: Date; amountPaid: DecimalInput }[],
  now: Date,
) {
  const week = getReportingWeekRange(now);
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Africa/Nairobi",
  });
  return Array.from({ length: 7 }, (_, index) => {
    const range = shiftRange(getBusinessDayRange(week.start), index);
    return {
      label: formatter.format(range.start),
      value: sumMoney(
        payments
          .filter((p) => p.createdAt >= range.start && p.createdAt < range.end)
          .map((p) => p.amountPaid),
      ).toNumber(),
    };
  });
}

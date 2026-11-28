import { Prisma } from "@prisma/client";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "Africa/Nairobi",
});

export function summarizeWeekdaySales(
  orders: readonly { closedAt: Date; netSales: string }[],
) {
  const rows = new Map(weekdays.map((day) => [day, {
    day,
    paidOrders: 0,
    netSales: new Prisma.Decimal(0),
  }]));
  for (const order of orders) {
    const row = rows.get(weekdayFormatter.format(order.closedAt))!;
    row.paidOrders += 1;
    row.netSales = row.netSales.plus(order.netSales);
  }
  return [...rows.values()].map((row) => ({
    day: row.day,
    paidOrders: row.paidOrders,
    netSales: row.netSales.toFixed(2),
    averageOrderValue: row.paidOrders
      ? row.netSales.dividedBy(row.paidOrders).toFixed(2)
      : null,
  }));
}

export type WeekdaySalesRow = ReturnType<typeof summarizeWeekdaySales>[number];

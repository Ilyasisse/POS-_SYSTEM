import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateOrderTypeMetrics } from "@/lib/reports/order-type-metrics";
import type { ReportRange } from "@/lib/reports/reporting-calendar";
import type { ReportQuery } from "@/lib/reports/validation";

function reportFilters(query: ReportQuery): Prisma.OrderWhereInput {
  return {
    waiterId: query.waiterId,
    cashierId: query.cashierId,
    tableId: query.tableId,
    customerId: query.customerId,
    payments: query.paymentMethod
      ? { some: { method: query.paymentMethod as never } }
      : undefined,
    orderItems:
      query.productId || query.categoryId || query.station
        ? {
            some: {
              productId: query.productId,
              station: query.station as never,
              product: { categoryId: query.categoryId },
            },
          }
        : undefined,
  };
}

export async function getOrderTypeReport(
  range: ReportRange,
  query: ReportQuery,
) {
  const orders = await prisma.order.findMany({
    where: {
      ...reportFilters(query),
      status: "PAID",
      closedAt: { gte: range.start, lt: range.end },
    },
    select: {
      type: true,
      orderItems: { select: { lineTotal: true } },
      salesAdjustments: { select: { type: true, amount: true } },
    },
  });

  return {
    period: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      timezone: "Africa/Nairobi" as const,
      currency: "USD" as const,
    },
    orderTypes: calculateOrderTypeMetrics(orders),
  };
}

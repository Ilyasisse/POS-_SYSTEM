import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReportRange } from "@/lib/reports/reporting-calendar";
import { calculateStaffSalesMetrics } from "@/lib/reports/staff-sales-metrics";
import type { ReportQuery } from "@/lib/reports/validation";

function reportFilters(query: ReportQuery): Prisma.OrderWhereInput {
  return {
    waiterId: query.waiterId,
    cashierId: query.cashierId,
    tableId: query.tableId,
    customerId: query.customerId,
    OR: query.staffId
      ? [{ waiterId: query.staffId }, { cashierId: query.staffId }]
      : undefined,
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

export async function getStaffSalesReport(
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
      waiter: { select: { id: true, fullName: true } },
      cashier: { select: { id: true, fullName: true } },
      orderItems: { select: { lineTotal: true } },
      salesAdjustments: { select: { amount: true } },
    },
  });

  return {
    period: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      timezone: "Africa/Nairobi" as const,
      currency: "USD" as const,
    },
    attributionRule:
      "Sales credit goes to the assigned waiter; orders without a waiter go to the cashier.",
    staff: calculateStaffSalesMetrics(orders),
  };
}

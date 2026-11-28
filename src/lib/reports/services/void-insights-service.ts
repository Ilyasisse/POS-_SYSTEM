import "server-only";

import { prisma } from "@/lib/prisma";
import type { ReportRange } from "@/lib/reports/reporting-calendar";
import { summarizeVoidInsights } from "@/lib/reports/void-insights";

export async function getVoidInsights(range: ReportRange) {
  const orders = await prisma.order.findMany({
    where: {
      status: "CANCELLED",
      closedAt: { gte: range.start, lt: range.end },
      salesAdjustments: { some: { type: "VOID" } },
    },
    select: {
      orderItems: { select: { productId: true, productName: true, qty: true } },
      salesAdjustments: { where: { type: "VOID" }, select: { reason: true } },
    },
  });
  return summarizeVoidInsights(orders);
}

import "server-only";

import { prisma } from "@/lib/prisma";
import type { ReportRange } from "@/lib/reports/reporting-calendar";
import { summarizeRefundInsights } from "@/lib/reports/refund-insights";

export async function getRefundInsights(range: ReportRange) {
  const adjustments = await prisma.salesAdjustment.findMany({
    where: {
      type: "REFUND",
      createdAt: { gte: range.start, lt: range.end },
      order: { status: "PAID" },
    },
    select: {
      orderId: true,
      amount: true,
      orderItem: { select: { productId: true, productName: true } },
    },
  });
  return summarizeRefundInsights(
    adjustments.map((adjustment) => ({
      orderId: adjustment.orderId,
      amount: adjustment.amount.toFixed(2),
      orderItem: adjustment.orderItem,
    })),
  );
}

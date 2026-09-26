import "server-only";

import { prisma } from "@/lib/prisma";
import type { ReportRange } from "@/lib/reports/reporting-calendar";
import { summarizeInventoryLosses } from "@/lib/reports/inventory-losses";

export async function getInventoryLossReport(range: ReportRange) {
  const events = await prisma.stockEvent.findMany({
    where: {
      type: { in: ["WASTE", "SPOILAGE", "DAMAGE"] },
      quantityDelta: { lt: 0 },
      occurredAt: { gte: range.start, lt: range.end },
    },
    select: {
      productId: true,
      supplyId: true,
      type: true,
      canonicalUnit: true,
      quantityDelta: true,
      dataCoverage: true,
      standardUnitCostSnapshot: true,
      product: { select: { name: true } },
      supply: { select: { name: true } },
    },
  });
  return summarizeInventoryLosses(
    events.map((event) => ({
      productId: event.productId,
      supplyId: event.supplyId,
      name: event.product?.name ?? event.supply?.name ?? "Archived item",
      type: event.type,
      canonicalUnit: event.canonicalUnit,
      quantityDelta: event.quantityDelta.toString(),
      dataCoverage: event.dataCoverage,
      standardUnitCostSnapshot:
        event.standardUnitCostSnapshot?.toString() ?? null,
    })),
  );
}

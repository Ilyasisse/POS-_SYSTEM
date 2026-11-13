import type { Prisma } from "@prisma/client";
import type { ReportRange } from "./reporting-calendar";

/** Products that existed for the whole period and have no recognized sale. */
export function unsoldProductsWhere(range: ReportRange): Prisma.ProductWhereInput {
  return {
    isActive: true,
    category: { isActive: true },
    createdAt: { lte: range.start },
    orderItems: {
      none: { order: { status: "PAID", closedAt: { gte: range.start, lt: range.end } } },
    },
  };
}

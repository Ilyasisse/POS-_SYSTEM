import type { Prisma } from "@prisma/client";

export type SaleAvailabilityFilter = "all" | "for-sale" | "sold-out";

export function saleAvailabilityWhere(
  filter: SaleAvailabilityFilter,
  now: Date,
): Prisma.ProductWhereInput {
  if (filter === "for-sale") {
    return {
      OR: [
        { availableForSale: true },
        { availabilityRestoresAt: { lte: now } },
      ],
    };
  }
  if (filter === "sold-out") {
    return {
      availableForSale: false,
      OR: [
        { availabilityRestoresAt: null },
        { availabilityRestoresAt: { gt: now } },
      ],
    };
  }
  return {};
}

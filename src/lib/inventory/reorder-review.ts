import { Prisma } from "@prisma/client";

export function reorderStatus(
  stock: string | Prisma.Decimal,
  threshold: string | Prisma.Decimal,
): "OUT" | "LOW" | null {
  const available = new Prisma.Decimal(stock);
  const minimum = new Prisma.Decimal(threshold);
  if (available.lte(0)) return "OUT";
  if (minimum.gt(0) && available.lte(minimum)) return "LOW";
  return null;
}

export function validPurchaseItem(
  requestedId: string | undefined,
  available: readonly { id: string }[],
) {
  return available.some((item) => item.id === requestedId) ? requestedId! : "";
}

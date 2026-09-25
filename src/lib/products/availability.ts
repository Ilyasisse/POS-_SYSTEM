// Describes the availability fields a product needs.
export type ProductAvailability = {
  availableForSale: boolean;
  availabilityRestoresAt: Date | null;
};

// Checks if a product can be sold right now.
// It is available if:
// 1. availableForSale is true, OR
// 2. its temporary unavailable time has expired.
export function isProductAvailableForSale(
  product: ProductAvailability,
  now = new Date(),
) {
  return (
    product.availableForSale ||
    (product.availabilityRestoresAt !== null &&
      product.availabilityRestoresAt <= now)
  );
}

// Used in Prisma queries to only get products that can be sold right now.
export function availableForSaleWhere(now = new Date()) {
  return {
    OR: [{ availableForSale: true }, { availabilityRestoresAt: { lte: now } }],
  };
}

// Calculates when a temporarily unavailable product becomes available again.
// Example: Now = 8:00 AM + 30 minutes → restores at 8:30 AM.
// null means it will not automatically become available again.
export function availabilityRestorationTime(
  durationMinutes: number | null,
  now = new Date(),
) {
  return durationMinutes === null
    ? null
    : new Date(now.getTime() + durationMinutes * 60_000);
}

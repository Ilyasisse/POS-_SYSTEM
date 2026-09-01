export type ProductAvailability = {
  availableForSale: boolean;
  availabilityRestoresAt: Date | null;
};

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

export function availableForSaleWhere(now = new Date()) {
  return {
    OR: [
      { availableForSale: true },
      { availabilityRestoresAt: { lte: now } },
    ],
  };
}

export function availabilityRestorationTime(
  durationMinutes: number | null,
  now = new Date(),
) {
  return durationMinutes === null
    ? null
    : new Date(now.getTime() + durationMinutes * 60_000);
}

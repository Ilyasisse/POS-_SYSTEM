const MAX_OPEN_PRICE = 10_000;

export type PriceResolution =
  | { ok: true; basePrice: number; overridden: boolean }
  | { ok: false; error: string };

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function resolveProductBasePrice(input: {
  isOpenPrice: boolean;
  catalogPrice: number;
  submittedPrice?: unknown;
}): PriceResolution {
  if (!input.isOpenPrice) {
    return { ok: true, basePrice: money(input.catalogPrice), overridden: false };
  }

  const submittedPrice = Number(input.submittedPrice);
  if (
    !Number.isFinite(submittedPrice) ||
    submittedPrice <= 0 ||
    submittedPrice > MAX_OPEN_PRICE
  ) {
    return {
      ok: false,
      error: `Enter an open price greater than $0 and no more than $${MAX_OPEN_PRICE.toLocaleString("en-US")}.`,
    };
  }

  return { ok: true, basePrice: money(submittedPrice), overridden: true };
}

import { Prisma } from "@prisma/client";
import { parseCurrencyAmount } from "@/lib/currency/amount-input";

export const NAIROBI_TIME_ZONE = "Africa/Nairobi";

export type SupplyPurchaseInput = {
  catalogItemId: string;
  purchaseDateKey: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
};

export type SupplyPurchaseValidation =
  | { ok: true; value: SupplyPurchaseInput }
  | { ok: false; status: "invalid_date" | "invalid_entry" };

const QUANTITY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;

const nairobiDatePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: NAIROBI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function datePartsInNairobi(date: Date) {
  const parts = nairobiDatePartsFormatter.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export function getTodaySupplyDateKey(now = new Date()) {
  return datePartsInNairobi(now);
}

export function isValidSupplyDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function supplyDateKeyToDatabaseDate(value: string) {
  if (!isValidSupplyDateKey(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function resolveSupplyDateKey(
  value: string | undefined,
  now = new Date(),
) {
  const today = getTodaySupplyDateKey(now);
  if (!value || !isValidSupplyDateKey(value) || value > today) return today;
  return value;
}

export function getSupplyHistoryStartDateKey(
  selectedDateKey: string,
  days = 30,
) {
  const date = supplyDateKeyToDatabaseDate(selectedDateKey);
  if (!date) return selectedDateKey;
  date.setUTCDate(date.getUTCDate() - Math.max(days - 1, 0));
  return date.toISOString().slice(0, 10);
}

export function parseSupplyPurchaseInput(
  formData: FormData,
  now = new Date(),
): SupplyPurchaseValidation {
  const catalogItemId = String(formData.get("catalogItemId") ?? "").trim();
  const purchaseDateKey = String(formData.get("purchaseDate") ?? "").trim();
  const quantityInput = String(formData.get("quantity") ?? "").trim();
  const unitPriceInput = String(formData.get("unitPrice") ?? "").trim();
  const today = getTodaySupplyDateKey(now);

  if (!isValidSupplyDateKey(purchaseDateKey) || purchaseDateKey > today) {
    return { ok: false, status: "invalid_date" };
  }

  const unitPrice = parseCurrencyAmount(unitPriceInput);
  if (
    !catalogItemId ||
    !QUANTITY_PATTERN.test(quantityInput) ||
    !unitPriceInput ||
    unitPrice === null
  ) {
    return { ok: false, status: "invalid_entry" };
  }

  const quantity = new Prisma.Decimal(quantityInput);
  if (quantity.lte(0)) return { ok: false, status: "invalid_entry" };

  return {
    ok: true,
    value: {
      catalogItemId,
      purchaseDateKey,
      quantity,
      unitPrice: new Prisma.Decimal(unitPriceInput),
    },
  };
}

export function calculateSupplyLineTotal(
  quantity: Prisma.Decimal.Value,
  unitPrice: Prisma.Decimal.Value,
) {
  return new Prisma.Decimal(quantity)
    .mul(unitPrice)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateSupplyDayTotal(
  rows: Iterable<{
    quantity: Prisma.Decimal.Value;
    unitPrice: Prisma.Decimal.Value;
  }>,
) {
  let total = new Prisma.Decimal(0);
  for (const row of rows) {
    total = total.add(calculateSupplyLineTotal(row.quantity, row.unitPrice));
  }
  return total.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

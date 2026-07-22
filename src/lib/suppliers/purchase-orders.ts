import { Prisma } from "@prisma/client";
import { parseCurrencyAmount } from "@/lib/currency/amount-input";

export const SUPPLIER_PURCHASE_TIME_ZONE = "Africa/Nairobi";

export type SupplierCatalogTargetKind = "product" | "supply";

export type SupplierCatalogItemInput = {
  targetKind: SupplierCatalogTargetKind;
  targetId: string;
  unit: string;
  unitPrice: Prisma.Decimal;
  isActive: boolean;
};

export type SupplierCatalogItemValidation =
  | { ok: true; value: SupplierCatalogItemInput }
  | {
      ok: false;
      status: "invalid_target" | "invalid_unit" | "invalid_price";
    };

export type SupplierPurchaseOrderRowInput = {
  catalogItemId: string;
  quantity: string;
};

export type ValidatedSupplierPurchaseOrderRow = {
  catalogItemId: string;
  quantity: Prisma.Decimal;
};

export type SupplierPurchaseOrderRowValidation =
  | { ok: true; rows: ValidatedSupplierPurchaseOrderRow[] }
  | { ok: false; status: "empty_order" | "duplicate_item" | "invalid_row" };

const QUANTITY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;
const MAX_QUANTITY = new Prisma.Decimal("999999999.999");
const MAX_UNIT_PRICE = new Prisma.Decimal("9999999999.99");
const MAX_ORDER_TOTAL = new Prisma.Decimal("999999999999.99");

function dateKeyInNairobi(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SUPPLIER_PURCHASE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function isValidSupplierPurchaseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function supplierPurchaseDateKeyToDatabaseDate(value: string) {
  if (!isValidSupplierPurchaseDateKey(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function getSupplierPurchaseTodayDateKey(now = new Date()) {
  return dateKeyInNairobi(now);
}

export function getSupplierBillDefaultDueDateKey(now = new Date()) {
  const today = getSupplierPurchaseTodayDateKey(now);
  const date = supplierPurchaseDateKeyToDatabaseDate(today);
  if (!date) throw new Error("Unable to calculate the supplier bill due date.");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function parseSupplierCatalogItemInput(input: {
  targetKind?: unknown;
  targetId?: unknown;
  unit?: unknown;
  unitPrice?: unknown;
  isActive?: unknown;
}): SupplierCatalogItemValidation {
  const targetKind = String(input.targetKind ?? "").trim();
  const targetId = String(input.targetId ?? "").trim();
  const unit = String(input.unit ?? "").trim();
  const unitPriceInput = String(input.unitPrice ?? "").trim();

  if (
    (targetKind !== "product" && targetKind !== "supply") ||
    !targetId ||
    targetId.length > 191
  ) {
    return { ok: false, status: "invalid_target" };
  }
  if (!unit || unit.length > 40) {
    return { ok: false, status: "invalid_unit" };
  }

  const unitPrice = parseCurrencyAmount(unitPriceInput);
  if (unitPrice === null) return { ok: false, status: "invalid_price" };
  const unitPriceDecimal = new Prisma.Decimal(unitPriceInput);
  if (unitPriceDecimal.gt(MAX_UNIT_PRICE)) {
    return { ok: false, status: "invalid_price" };
  }

  return {
    ok: true,
    value: {
      targetKind,
      targetId,
      unit,
      unitPrice: unitPriceDecimal,
      isActive:
        input.isActive === true ||
        input.isActive === "true" ||
        input.isActive === "on",
    },
  };
}

export function validateSupplierPurchaseOrderRows(
  input: readonly SupplierPurchaseOrderRowInput[],
): SupplierPurchaseOrderRowValidation {
  if (input.length === 0) return { ok: false, status: "empty_order" };

  const seen = new Set<string>();
  const rows: ValidatedSupplierPurchaseOrderRow[] = [];
  for (const row of input) {
    const catalogItemId = row.catalogItemId.trim();
    const quantityInput = row.quantity.trim();
    if (
      !catalogItemId ||
      catalogItemId.length > 191 ||
      !QUANTITY_PATTERN.test(quantityInput)
    ) {
      return { ok: false, status: "invalid_row" };
    }
    if (seen.has(catalogItemId)) {
      return { ok: false, status: "duplicate_item" };
    }

    const quantity = new Prisma.Decimal(quantityInput);
    if (quantity.lte(0) || quantity.gt(MAX_QUANTITY)) {
      return { ok: false, status: "invalid_row" };
    }
    seen.add(catalogItemId);
    rows.push({ catalogItemId, quantity });
  }

  return { ok: true, rows };
}

export function calculateSupplierPurchaseOrderLineTotal(
  quantity: Prisma.Decimal.Value,
  unitPrice: Prisma.Decimal.Value,
) {
  const total = new Prisma.Decimal(quantity)
    .mul(unitPrice)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (total.gt(MAX_ORDER_TOTAL)) {
    throw new Error("Supplier purchase-order total exceeds the supported limit.");
  }
  return total;
}

export function calculateSupplierPurchaseOrderTotal(
  rows: Iterable<{
    quantity: Prisma.Decimal.Value;
    unitPrice: Prisma.Decimal.Value;
  }>,
) {
  let total = new Prisma.Decimal(0);
  for (const row of rows) {
    total = total.add(
      calculateSupplierPurchaseOrderLineTotal(row.quantity, row.unitPrice),
    );
    if (total.gt(MAX_ORDER_TOTAL)) {
      throw new Error("Supplier purchase-order total exceeds the supported limit.");
    }
  }
  return total.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

import { Prisma, type CanonicalUnit } from "@prisma/client";
import { canonicalUnitLabel, classifyLegacyUnit } from "./inventory-domain";

const countUnits = new Set(["box", "haan", "barrel", "bottle", "4liters", "kiish", "travel"]);
const stockLimit = new Prisma.Decimal("1000000000000");

export function classifySupplyUnit(unit: string, countAsEntered = false) {
  const mapping = classifyLegacyUnit(unit);
  if (mapping.canonicalUnit) return mapping;

  return countAsEntered || countUnits.has(unit.trim().toLowerCase())
    ? { ...mapping, canonicalUnit: "PIECE" as const, coverage: "COMPLETE" as const }
    : mapping;
}

export function supplyStockUnit({
  unit,
  canonicalUnit,
}: {
  unit: string;
  canonicalUnit: CanonicalUnit | null;
}) {
  const recorded = unit.trim() || "unit";
  const mapping = classifySupplyUnit(recorded);
  const matches = !mapping.canonicalUnit
    ? canonicalUnit === "PIECE"
    : mapping.canonicalUnit === canonicalUnit;
  const factor = matches ? mapping.factor : new Prisma.Decimal(1);
  const label = !canonicalUnit || matches ? recorded : canonicalUnitLabel(canonicalUnit);
  return {
    label,
    factor,
    step: new Prisma.Decimal("0.000001").div(factor).toFixed(),
    token: JSON.stringify([recorded, canonicalUnit, factor.toFixed()]),
  };
}

export function supplyDisplayQuantity(value: Prisma.Decimal, factor: Prisma.Decimal) {
  return value.div(factor).toFixed();
}

// The value is already in its displayed/recorded unit, including legacy history.
export function supplyQuantityLabel(value: string, unit: string) {
  const quantity = new Prisma.Decimal(value);
  const mapping = classifyLegacyUnit(unit);
  if (mapping.canonicalUnit !== "GRAM")
    return [quantity.toFixed(), unit].filter(Boolean).join(" ");

  const grams = quantity.abs().mul(mapping.factor);
  const kilograms = grams.div(1000).floor();
  const remainder = grams.mod(1000);
  const parts: string[] = [];
  if (kilograms.gt(0)) parts.push(kilograms.toFixed() + " kg");
  if (remainder.gt(0) || parts.length === 0) parts.push(remainder.toFixed() + " g");
  return (quantity.lt(0) ? "-" : "") + parts.join(" ");
}

export function supplyInputQuantity(
  value: string,
  factor: Prisma.Decimal,
  { positive = false, field = "Quantity" } = {},
) {
  let quantity;
  try {
    quantity = new Prisma.Decimal(value);
  } catch {
    throw new Error(field + " must be a valid number.");
  }
  const canonical = quantity.mul(factor);
  if (
    !canonical.isFinite() ||
    canonical.lt(0) ||
    (positive && canonical.isZero()) ||
    canonical.gte(stockLimit)
  ) {
    throw new Error(
      positive
        ? field + " must be greater than zero and within range."
        : field + " must be zero or greater and within range.",
    );
  }
  const decimalPlaces = factor.eq(1000) ? 9 : 6;
  if (quantity.decimalPlaces() > decimalPlaces) {
    throw new Error(field + " supports up to " + decimalPlaces + " decimal places in this unit.");
  }
  return canonical;
}

export function supplyMovementDisplay({
  itemName,
  delta,
  canonicalUnit,
  supply,
}: {
  itemName: string;
  delta: Prisma.Decimal;
  canonicalUnit: CanonicalUnit | null;
  supply?: { unit: string } | null;
}) {
  // Movements record the stock unit in the item name at the time of the change.
  const suffix = supply && " (" + supply.unit + ")";
  const snapshot =
    suffix && itemName.endsWith(suffix)
      ? [itemName, itemName.slice(0, -suffix.length), supply.unit]
      : /^([\s\S]*) \(([^()]+)\)$/.exec(itemName);
  if (!snapshot) {
    return {
      name: itemName,
      quantity: delta.toFixed(),
      unit: canonicalUnit ? canonicalUnitLabel(canonicalUnit) : "",
    };
  }

  const stockUnit = supplyStockUnit({ unit: snapshot[2], canonicalUnit });
  return {
    name: snapshot[1],
    quantity: supplyDisplayQuantity(delta, stockUnit.factor),
    unit: stockUnit.label,
  };
}

// Existing ledger quantities keep their dimension when the recorded unit is edited.
export function supplyEditMapping(
  current: { unit: string; canonicalUnit: CanonicalUnit | null },
  nextUnit: string,
  countAsEntered: boolean,
) {
  const mapping = classifySupplyUnit(nextUnit, countAsEntered);
  if (!nextUnit.trim() || !mapping.canonicalUnit)
    throw new Error("Choose a known unit or confirm that each custom unit counts as one.");
  if (current.canonicalUnit && current.canonicalUnit !== mapping.canonicalUnit)
    throw new Error(
      "Use a unit of the same type (weight, volume, or count). Create a separate supply for a different type.",
    );
  const legacy = classifySupplyUnit(current.unit, countAsEntered);
  if (!current.canonicalUnit && legacy.canonicalUnit !== mapping.canonicalUnit)
    throw new Error(
      "First configure the existing unit. For a custom counted unit, confirm that each unit counts as one.",
    );
  return {
    canonicalUnit: mapping.canonicalUnit,
    factor: mapping.factor,
    legacyFactor: current.canonicalUnit ? new Prisma.Decimal(1) : legacy.factor,
  };
}

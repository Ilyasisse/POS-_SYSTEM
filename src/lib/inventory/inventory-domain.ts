import { Prisma, type CanonicalUnit, type InventoryDataCoverage } from "@prisma/client";

const ZERO = new Prisma.Decimal(0);
const QUANTITY_SCALE = 6;
const COST_SCALE = 6;

export type DecimalInput = Prisma.Decimal | string | number;

export function decimalQuantity(value: DecimalInput, field = "Quantity") {
  let quantity: Prisma.Decimal;
  try {
    quantity = new Prisma.Decimal(value).toDecimalPlaces(
      QUANTITY_SCALE,
      Prisma.Decimal.ROUND_HALF_UP,
    );
  } catch {
    throw new Error(`${field} must be a valid decimal quantity.`);
  }
  if (!quantity.isFinite() || quantity.isNegative()) {
    throw new Error(`${field} must be zero or greater.`);
  }
  return quantity;
}

export function positiveDecimalQuantity(value: DecimalInput, field = "Quantity") {
  const quantity = decimalQuantity(value, field);
  if (quantity.lte(ZERO)) throw new Error(`${field} must be greater than zero.`);
  return quantity;
}

export function decimalCost(value: DecimalInput, field = "Cost") {
  const cost = decimalQuantity(value, field).toDecimalPlaces(
    COST_SCALE,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  return cost;
}

export function canonicalUnitLabel(unit: CanonicalUnit | null) {
  if (unit === "GRAM") return "g";
  if (unit === "MILLILITRE") return "ml";
  if (unit === "PIECE") return "piece";
  return "unmapped unit";
}

export type LegacyUnitConversion = {
  canonicalUnit: CanonicalUnit | null;
  factor: Prisma.Decimal;
  coverage: InventoryDataCoverage;
};

export function classifyLegacyUnit(unit: string): LegacyUnitConversion {
  const normalized = unit.trim().toLowerCase();
  if (["g", "gm", "gram", "grams"].includes(normalized)) {
    return { canonicalUnit: "GRAM", factor: new Prisma.Decimal(1), coverage: "COMPLETE" };
  }
  if (["kg", "kilogram", "kilograms"].includes(normalized)) {
    return { canonicalUnit: "GRAM", factor: new Prisma.Decimal(1000), coverage: "COMPLETE" };
  }
  if (["ml", "milliliter", "milliliters", "millilitre", "millilitres"].includes(normalized)) {
    return { canonicalUnit: "MILLILITRE", factor: new Prisma.Decimal(1), coverage: "COMPLETE" };
  }
  if (["l", "liter", "liters", "litre", "litres"].includes(normalized)) {
    return { canonicalUnit: "MILLILITRE", factor: new Prisma.Decimal(1000), coverage: "COMPLETE" };
  }
  if (["piece", "pieces", "pc", "pcs", "unit", "units", "each"].includes(normalized)) {
    return { canonicalUnit: "PIECE", factor: new Prisma.Decimal(1), coverage: "COMPLETE" };
  }
  return { canonicalUnit: null, factor: new Prisma.Decimal(1), coverage: "LEGACY_INCOMPLETE" };
}

export function convertLegacyQuantity(quantity: DecimalInput, unit: string) {
  const conversion = classifyLegacyUnit(unit);
  return {
    ...conversion,
    quantity: decimalQuantity(quantity).mul(conversion.factor),
  };
}

export function convertPurchaseQuantity(
  purchasedQuantity: DecimalInput,
  canonicalQuantityPerPurchaseUnit: DecimalInput,
) {
  return positiveDecimalQuantity(purchasedQuantity, "Purchased quantity")
    .mul(positiveDecimalQuantity(canonicalQuantityPerPurchaseUnit, "Purchase-unit conversion"))
    .toDecimalPlaces(QUANTITY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateRecipeStandardCost(
  yieldQuantity: DecimalInput,
  ingredients: readonly {
    quantity: DecimalInput;
    standardUnitCost: DecimalInput | null;
  }[],
) {
  const recipeYield = positiveDecimalQuantity(yieldQuantity, "Recipe yield");
  if (ingredients.some((ingredient) => ingredient.standardUnitCost == null)) {
    return { unitCost: null, coverage: "MISSING_COST" as const };
  }
  const total = ingredients.reduce(
    (sum, ingredient) =>
      sum.add(
        positiveDecimalQuantity(ingredient.quantity, "Ingredient quantity").mul(
          decimalCost(ingredient.standardUnitCost!, "Ingredient cost"),
        ),
      ),
    ZERO,
  );
  return {
    unitCost: total.div(recipeYield).toDecimalPlaces(COST_SCALE, Prisma.Decimal.ROUND_HALF_UP),
    coverage: "COMPLETE" as const,
  };
}

export function selectEffectiveRecipe<T extends { effectiveFrom: Date; effectiveTo: Date | null; isActive: boolean }>(
  versions: readonly T[],
  at: Date,
) {
  return versions
    .filter(
      (version) =>
        version.isActive &&
        version.effectiveFrom <= at &&
        (version.effectiveTo == null || version.effectiveTo > at),
    )
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ?? null;
}

export function snapshotInventoryCost(
  recipe: { id: string; standardCost: Prisma.Decimal | null; costCoverage: InventoryDataCoverage } | null,
  productCost: Prisma.Decimal | null,
) {
  if (recipe) {
    return recipe.standardCost != null && recipe.costCoverage === "COMPLETE"
      ? {
          unitCostSnapshot: recipe.standardCost,
          costSnapshotSource: "RECIPE_STANDARD" as const,
          recipeVersionId: recipe.id,
        }
      : {
          unitCostSnapshot: null,
          costSnapshotSource: null,
          recipeVersionId: recipe.id,
        };
  }
  if (productCost != null) {
    return {
      unitCostSnapshot: productCost,
      costSnapshotSource: "PRODUCT_STANDARD" as const,
      recipeVersionId: null,
    };
  }
  return { unitCostSnapshot: null, costSnapshotSource: null, recipeVersionId: null };
}

export function calculateCountVariance(expected: DecimalInput, physical: DecimalInput) {
  return decimalQuantity(physical, "Physical quantity")
    .sub(decimalQuantity(expected, "Expected quantity"))
    .toDecimalPlaces(QUANTITY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

export function inventoryValue(quantity: DecimalInput, unitCost: DecimalInput | null) {
  if (unitCost == null) return null;
  return decimalQuantity(quantity).mul(decimalCost(unitCost)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

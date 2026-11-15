import { expect, test } from "@jest/globals";

import { Prisma } from "@prisma/client";
import { getPermissionsForRole, PERMISSIONS } from "../../src/lib/auth/permissions";
import {
  calculateCountVariance,
  calculateRecipeStandardCost,
  classifyLegacyUnit,
  convertLegacyQuantity,
  convertPurchaseQuantity,
  decimalCost,
  decimalQuantity,
  inventoryValue,
  selectEffectiveRecipe,
  snapshotInventoryCost,
} from "../../src/lib/inventory/inventory-domain";

test("decimal quantities retain three and six-place precision without floating point", () => {
  expect(decimalQuantity("0.125").toString()).toBe("0.125");
  expect(decimalQuantity("1.2345678").toString()).toBe("1.234568");
  expect(decimalCost("1.2345678").toString()).toBe("1.234568");
});

test("negative and invalid quantities are rejected", () => {
  expect(() => decimalQuantity("-0.001")).toThrow(/zero or greater/);
  expect(() => decimalQuantity("not-a-number")).toThrow(/valid decimal/);
});

test("kilograms convert confidently to grams", () => {
  const result = convertLegacyQuantity("2.5", "kg");
  expect(result.canonicalUnit).toBe("GRAM");
  expect(result.quantity.toString()).toBe("2500");
  expect(result.coverage).toBe("COMPLETE");
});

test("grams remain grams", () => {
  expect(convertLegacyQuantity("12.5", "grams").quantity.toString()).toBe("12.5");
});

test("litres convert confidently to millilitres", () => {
  const result = convertLegacyQuantity("1.25", "litre");
  expect(result.canonicalUnit).toBe("MILLILITRE");
  expect(result.quantity.toString()).toBe("1250");
});

test("pieces remain pieces", () => {
  const result = classifyLegacyUnit("pcs");
  expect(result.canonicalUnit).toBe("PIECE");
  expect(result.factor.toString()).toBe("1");
});

test("unknown legacy units remain visible and incomplete", () => {
  const result = convertLegacyQuantity("4", "mystery-bag");
  expect(result.canonicalUnit).toBe(null);
  expect(result.quantity.toString()).toBe("4");
  expect(result.coverage).toBe("LEGACY_INCOMPLETE");
});

test("purchase-unit conversion resolves cartons into canonical quantity", () => {
  expect(convertPurchaseQuantity("2.5", "12000").toString()).toBe("30000");
});

test("recipe standard cost is divided by recipe yield", () => {
  const result = calculateRecipeStandardCost("2", [
    { quantity: "100", standardUnitCost: "0.004" },
    { quantity: "50", standardUnitCost: "0.006" },
  ]);
  expect(result.unitCost?.toString()).toBe("0.35");
  expect(result.coverage).toBe("COMPLETE");
});

test("recipe cost remains unavailable when an ingredient has no standard cost", () => {
  const result = calculateRecipeStandardCost("1", [{ quantity: "10", standardUnitCost: null }]);
  expect(result.unitCost).toBe(null);
  expect(result.coverage).toBe("MISSING_COST");
});

test("effective recipe selection honors dates and chooses the newest version", () => {
  const selected = selectEffectiveRecipe(
    [
      {
        id: "old",
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: null,
        isActive: true,
      },
      {
        id: "new",
        effectiveFrom: new Date("2026-07-01"),
        effectiveTo: null,
        isActive: true,
      },
      {
        id: "future",
        effectiveFrom: new Date("2027-01-01"),
        effectiveTo: null,
        isActive: true,
      },
    ],
    new Date("2026-08-08"),
  );
  expect(selected?.id).toBe("new");
});

test("recipe snapshot takes precedence over product standard cost", () => {
  const snapshot = snapshotInventoryCost(
    {
      id: "recipe-2",
      standardCost: new Prisma.Decimal("1.25"),
      costCoverage: "COMPLETE",
    },
    new Prisma.Decimal("2.00"),
  );
  expect(snapshot.unitCostSnapshot?.toString()).toBe("1.25");
  expect(snapshot.costSnapshotSource).toBe("RECIPE_STANDARD");
  expect(snapshot.recipeVersionId).toBe("recipe-2");
});

test("product standard cost is the fallback and missing costs are not fabricated", () => {
  const product = snapshotInventoryCost(null, new Prisma.Decimal("2.50"));
  expect(product.costSnapshotSource).toBe("PRODUCT_STANDARD");
  expect(product.recipeVersionId).toBe(null);
  const missing = snapshotInventoryCost(null, null);
  expect(missing.unitCostSnapshot).toBe(null);
  expect(missing.costSnapshotSource).toBe(null);
});

test("an effective recipe with incomplete cost stays linked and does not use product fallback", () => {
  const snapshot = snapshotInventoryCost(
    {
      id: "recipe-incomplete",
      standardCost: null,
      costCoverage: "MISSING_COST",
    },
    new Prisma.Decimal("9.99"),
  );
  expect(snapshot.unitCostSnapshot).toBe(null);
  expect(snapshot.costSnapshotSource).toBe(null);
  expect(snapshot.recipeVersionId).toBe("recipe-incomplete");
});

test("physical-count variance uses Decimal arithmetic", () => {
  expect(calculateCountVariance("10.125", "9.875").toString()).toBe("-0.25");
});

test("inventory value is unavailable without cost and rounded with Decimal", () => {
  expect(inventoryValue("12.5", null)).toBe(null);
  expect(inventoryValue("12.5", "0.333333")?.toString()).toBe("4.17");
});

test("standard-cost permission is admin-only and count approval is manager-capable", () => {
  const admin = getPermissionsForRole("ADMIN");
  const manager = getPermissionsForRole("MANAGER");
  expect(admin.includes(PERMISSIONS.INVENTORY_COST_MANAGE)).toBeTruthy();
  expect(!manager.includes(PERMISSIONS.INVENTORY_COST_MANAGE)).toBeTruthy();
  expect(manager.includes(PERMISSIONS.INVENTORY_COUNT_APPROVE)).toBeTruthy();
});

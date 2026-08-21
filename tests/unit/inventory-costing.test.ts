import assert from "node:assert/strict";
import test from "node:test";
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
  assert.equal(decimalQuantity("0.125").toString(), "0.125");
  assert.equal(decimalQuantity("1.2345678").toString(), "1.234568");
  assert.equal(decimalCost("1.2345678").toString(), "1.234568");
});

test("negative and invalid quantities are rejected", () => {
  assert.throws(() => decimalQuantity("-0.001"), /zero or greater/);
  assert.throws(() => decimalQuantity("not-a-number"), /valid decimal/);
});

test("kilograms convert confidently to grams", () => {
  const result = convertLegacyQuantity("2.5", "kg");
  assert.equal(result.canonicalUnit, "GRAM");
  assert.equal(result.quantity.toString(), "2500");
  assert.equal(result.coverage, "COMPLETE");
});

test("grams remain grams", () => {
  assert.equal(convertLegacyQuantity("12.5", "grams").quantity.toString(), "12.5");
});

test("litres convert confidently to millilitres", () => {
  const result = convertLegacyQuantity("1.25", "litre");
  assert.equal(result.canonicalUnit, "MILLILITRE");
  assert.equal(result.quantity.toString(), "1250");
});

test("pieces remain pieces", () => {
  const result = classifyLegacyUnit("pcs");
  assert.equal(result.canonicalUnit, "PIECE");
  assert.equal(result.factor.toString(), "1");
});

test("unknown legacy units remain visible and incomplete", () => {
  const result = convertLegacyQuantity("4", "mystery-bag");
  assert.equal(result.canonicalUnit, null);
  assert.equal(result.quantity.toString(), "4");
  assert.equal(result.coverage, "LEGACY_INCOMPLETE");
});

test("purchase-unit conversion resolves cartons into canonical quantity", () => {
  assert.equal(convertPurchaseQuantity("2.5", "12000").toString(), "30000");
});

test("recipe standard cost is divided by recipe yield", () => {
  const result = calculateRecipeStandardCost("2", [
    { quantity: "100", standardUnitCost: "0.004" },
    { quantity: "50", standardUnitCost: "0.006" },
  ]);
  assert.equal(result.unitCost?.toString(), "0.35");
  assert.equal(result.coverage, "COMPLETE");
});

test("recipe cost remains unavailable when an ingredient has no standard cost", () => {
  const result = calculateRecipeStandardCost("1", [
    { quantity: "10", standardUnitCost: null },
  ]);
  assert.equal(result.unitCost, null);
  assert.equal(result.coverage, "MISSING_COST");
});

test("effective recipe selection honors dates and chooses the newest version", () => {
  const selected = selectEffectiveRecipe(
    [
      { id: "old", effectiveFrom: new Date("2026-01-01"), effectiveTo: null, isActive: true },
      { id: "new", effectiveFrom: new Date("2026-07-01"), effectiveTo: null, isActive: true },
      { id: "future", effectiveFrom: new Date("2027-01-01"), effectiveTo: null, isActive: true },
    ],
    new Date("2026-08-08"),
  );
  assert.equal(selected?.id, "new");
});

test("recipe snapshot takes precedence over product standard cost", () => {
  const snapshot = snapshotInventoryCost(
    { id: "recipe-2", standardCost: new Prisma.Decimal("1.25"), costCoverage: "COMPLETE" },
    new Prisma.Decimal("2.00"),
  );
  assert.equal(snapshot.unitCostSnapshot?.toString(), "1.25");
  assert.equal(snapshot.costSnapshotSource, "RECIPE_STANDARD");
  assert.equal(snapshot.recipeVersionId, "recipe-2");
});

test("product standard cost is the fallback and missing costs are not fabricated", () => {
  const product = snapshotInventoryCost(null, new Prisma.Decimal("2.50"));
  assert.equal(product.costSnapshotSource, "PRODUCT_STANDARD");
  assert.equal(product.recipeVersionId, null);
  const missing = snapshotInventoryCost(null, null);
  assert.equal(missing.unitCostSnapshot, null);
  assert.equal(missing.costSnapshotSource, null);
});

test("an effective recipe with incomplete cost stays linked and does not use product fallback", () => {
  const snapshot = snapshotInventoryCost(
    { id: "recipe-incomplete", standardCost: null, costCoverage: "MISSING_COST" },
    new Prisma.Decimal("9.99"),
  );
  assert.equal(snapshot.unitCostSnapshot, null);
  assert.equal(snapshot.costSnapshotSource, null);
  assert.equal(snapshot.recipeVersionId, "recipe-incomplete");
});

test("physical-count variance uses Decimal arithmetic", () => {
  assert.equal(calculateCountVariance("10.125", "9.875").toString(), "-0.25");
});

test("inventory value is unavailable without cost and rounded with Decimal", () => {
  assert.equal(inventoryValue("12.5", null), null);
  assert.equal(inventoryValue("12.5", "0.333333")?.toString(), "4.17");
});

test("standard-cost permission is admin-only and count approval is manager-capable", () => {
  const admin = getPermissionsForRole("ADMIN");
  const manager = getPermissionsForRole("MANAGER");
  assert.ok(admin.includes(PERMISSIONS.INVENTORY_COST_MANAGE));
  assert.ok(!manager.includes(PERMISSIONS.INVENTORY_COST_MANAGE));
  assert.ok(manager.includes(PERMISSIONS.INVENTORY_COUNT_APPROVE));
});

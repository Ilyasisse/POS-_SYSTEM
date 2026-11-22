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
import {
  classifySupplyUnit,
  supplyDisplayQuantity,
  supplyQuantityLabel,
  supplyInputQuantity,
  supplyMovementDisplay,
  supplyStockUnit,
} from "../../src/lib/inventory/supply-units";

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

test("supply forms display recorded units and convert exact quantities back to stock", () => {
  const kg = supplyStockUnit({ unit: "Kg", canonicalUnit: "GRAM" });
  assert.equal(kg.label, "Kg");
  assert.equal(supplyDisplayQuantity(decimalQuantity("3000"), kg.factor), "3");
  assert.equal(supplyInputQuantity("0.5", kg.factor).toFixed(), "500");
  assert.equal(supplyInputQuantity(kg.step, kg.factor).toFixed(), "0.000001");
  assert.throws(() => supplyInputQuantity("0.0000000001", kg.factor), /9 decimal places/);

  const litres = supplyStockUnit({ unit: "litres", canonicalUnit: "MILLILITRE" });
  assert.equal(supplyInputQuantity("1.25", litres.factor).toFixed(), "1250");
  assert.notEqual(kg.token, supplyStockUnit({ unit: "g", canonicalUnit: "GRAM" }).token);
});

test("confirmed packages and trips use their recorded count without scaling stock", () => {
  for (const unit of ["Box", "Haan", "Barrel", "Bottle", "4Liters", "kiish", "Travel"]) {
    assert.equal(classifySupplyUnit(unit).canonicalUnit, "PIECE");
    const stockUnit = supplyStockUnit({ unit, canonicalUnit: "PIECE" });
    assert.equal(stockUnit.label, unit);
    assert.equal(supplyDisplayQuantity(decimalQuantity("2"), stockUnit.factor), "2");
  }
  assert.equal(classifySupplyUnit("bucket").canonicalUnit, null);
  assert.equal(classifySupplyUnit("bucket", true).canonicalUnit, "PIECE");
});

test("recent activity converts canonical movements and preserves historical amounts", () => {
  const before = { itemName: "Bariis (Kg)", delta: decimalQuantity("0.5").negated() };
  assert.deepEqual(supplyMovementDisplay({ ...before, canonicalUnit: null }), {
    name: "Bariis",
    quantity: "-0.5",
    unit: "Kg",
  });
  assert.deepEqual(
    supplyMovementDisplay({
      ...before,
      delta: decimalQuantity("500").negated(),
      canonicalUnit: "GRAM",
    }),
    supplyMovementDisplay({ ...before, canonicalUnit: null }),
  );
  assert.deepEqual(
    supplyMovementDisplay({
      itemName: "Caano (large bottle (4L))",
      delta: decimalQuantity("1"),
      canonicalUnit: "PIECE",
      supply: { unit: "large bottle (4L)" },
    }),
    { name: "Caano", quantity: "1", unit: "large bottle (4L)" },
  );
});


test("weight labels split kilograms and grams without rounding or padding", () => {
  for (const [value, unit, expected] of [
    ["1.250000", "kg", "1 kg 250 g"],
    ["1.05", "Kg", "1 kg 50 g"],
    ["0.5", "kilograms", "500 g"],
    ["2", "kg", "2 kg"],
    ["0", "kg", "0 g"],
    ["-0", "kg", "0 g"],
    ["1250", "grams", "1 kg 250 g"],
    ["0.125000", "g", "0.125 g"],
    ["1.250000001", "kg", "1 kg 250.000001 g"],
    ["999999999999.999999", "g", "999999999 kg 999.999999 g"],
    ["-1.25", "kg", "-1 kg 250 g"],
    ["-0.05", "kg", "-50 g"],
  ]) assert.equal(supplyQuantityLabel(value, unit), expected);
});

test("count, volume, and unfamiliar unit labels preserve their quantities and units", () => {
  for (const [value, unit, expected] of [
    ["1.500000", "Box", "1.5 Box"],
    ["0.5", "unit", "0.5 unit"],
    ["2.500000", "litres", "2.5 litres"],
    ["1250", "ml", "1250 ml"],
    ["1.500000", "large bottle (4L)", "1.5 large bottle (4L)"],
    ["-0.500000", "custom package", "-0.5 custom package"],
    ["1.500000", "", "1.5"],
  ]) assert.equal(supplyQuantityLabel(value, unit), expected);
});

test("weight labels leave numeric form values, fractional boxes, and costs exact", () => {
  const kg = supplyStockUnit({ unit: "kg", canonicalUnit: "GRAM" });
  const numeric = supplyDisplayQuantity(decimalQuantity("1250"), kg.factor);
  assert.equal(supplyQuantityLabel(numeric, kg.label), "1 kg 250 g");
  assert.equal(numeric, "1.25");
  assert.equal(supplyInputQuantity(numeric, kg.factor).toFixed(), "1250");
  const box = supplyStockUnit({ unit: "Box", canonicalUnit: "PIECE" });
  assert.equal(supplyInputQuantity("1.5", box.factor).toFixed(), "1.5");
  assert.equal(decimalCost("0.000333").toFixed(), "0.000333");
});

test("movement labels preserve legacy weights and the historical unit after edits", () => {
  for (const movement of [
    { itemName: "Bariis (Kg)", delta: new Prisma.Decimal("-0.5"), canonicalUnit: null },
    { itemName: "Bariis (Kg)", delta: new Prisma.Decimal("-500"), canonicalUnit: "GRAM" as const },
    { itemName: "Bariis (g)", delta: new Prisma.Decimal("-500"), canonicalUnit: "GRAM" as const, supply: { unit: "kg" } },
    { itemName: "Bariis", delta: new Prisma.Decimal("-500"), canonicalUnit: "GRAM" as const },
  ]) {
    const display = supplyMovementDisplay(movement);
    assert.equal(supplyQuantityLabel(display.quantity, display.unit), "-500 g");
  }
  const display = supplyMovementDisplay({
    itemName: "Cartons (Box)", delta: new Prisma.Decimal("-1.5"), canonicalUnit: "PIECE",
  });
  assert.equal(supplyQuantityLabel(display.quantity, display.unit), "-1.5 Box");
});

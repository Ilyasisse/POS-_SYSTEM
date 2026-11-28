import assert from "node:assert/strict";
import test from "node:test";
import { supplyEditMapping, supplyInputQuantity } from "../../src/lib/inventory/supply-units";
import { parseSupplyPurchaseInput } from "../../src/lib/supplies/supply-purchases";

test("editing kg to grams preserves canonical stock and threshold", () => {
  const current = { unit: "kg", canonicalUnit: "GRAM" as const };
  const kg = supplyEditMapping(current, "kilograms", false);
  const g = supplyEditMapping(current, "grams", false);
  assert.equal(
    supplyInputQuantity("3", kg.factor).toString(),
    supplyInputQuantity("3000", g.factor).toString(),
  );
  assert.equal(
    supplyInputQuantity("1", kg.factor).toString(),
    supplyInputQuantity("1000", g.factor).toString(),
  );
  assert.equal(g.legacyFactor.toString(), "1");
});

test("unit edits reject dimension changes and unconfirmed custom units", () => {
  const current = { unit: "kg", canonicalUnit: "GRAM" as const };
  for (const unit of ["litres", "box"]) {
    assert.throws(() => supplyEditMapping(current, unit, true), /same type/);
  }
  assert.throws(
    () => supplyEditMapping({ unit: "unit", canonicalUnit: "PIECE" }, "custom-bag", false),
    /confirm/,
  );
  assert.equal(
    supplyEditMapping(
      { unit: "box", canonicalUnit: "PIECE" },
      "custom-bag",
      true,
    ).factor.toString(),
    "1",
  );
});

test("legacy stock is normalized once without guessing an unknown package's weight", () => {
  const mapping = supplyEditMapping({ unit: "kg", canonicalUnit: null }, "g", false);
  assert.equal(mapping.legacyFactor.mul(3).toString(), "3000");
  assert.throws(
    () => supplyEditMapping({ unit: "custom-bag", canonicalUnit: null }, "kg", true),
    /existing unit/,
  );
  assert.equal(
    supplyEditMapping(
      { unit: "custom-bag", canonicalUnit: null },
      "custom-bag",
      true,
    ).legacyFactor.toString(),
    "1",
  );
});

test("missing supply days can be entered years earlier, but future and impossible dates fail", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  for (const [purchaseDate, expected] of [
    ["2024-02-29", true],
    ["2026-11-17", true],
    ["2026-11-19", false],
    ["2026-02-30", false],
  ] as const) {
    const form = new FormData();
    Object.entries({
      purchaseDate,
      catalogItemId: "flour",
      quantity: "3",
      unitPrice: "2.50",
    }).forEach(([key, value]) => form.set(key, value));
    const result = parseSupplyPurchaseInput(form, now);
    assert.equal(result.ok, expected);
    if (result.ok) assert.equal(result.value.purchaseDateKey, purchaseDate);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSupplierPurchaseOrderLineTotal,
  calculateSupplierPurchaseOrderTotal,
  getSupplierBillDefaultDueDateKey,
  getSupplierPurchaseTodayDateKey,
  isValidSupplierPurchaseDateKey,
  parseSupplierCatalogItemInput,
  supplierPurchaseDateKeyToDatabaseDate,
  validateSupplierPurchaseOrderRows,
} from "../../src/lib/suppliers/purchase-orders";

test("uses Nairobi dates and defaults supplier bills to the next day", () => {
  const now = new Date("2026-07-22T22:30:00.000Z");
  assert.equal(getSupplierPurchaseTodayDateKey(now), "2026-07-23");
  assert.equal(getSupplierBillDefaultDueDateKey(now), "2026-07-24");
});

test("validates real purchase-order calendar dates", () => {
  assert.equal(isValidSupplierPurchaseDateKey("2026-02-29"), false);
  assert.equal(isValidSupplierPurchaseDateKey("2028-02-29"), true);
  assert.equal(
    supplierPurchaseDateKeyToDatabaseDate("2026-07-22")?.toISOString(),
    "2026-07-22T00:00:00.000Z",
  );
});

test("validates supplier catalog targets, units, prices, and active state", () => {
  const result = parseSupplierCatalogItemInput({
    targetKind: "supply",
    targetId: "milk-id",
    unit: "crate",
    unitPrice: "12.50",
    isActive: "on",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.unitPrice.toString(), "12.5");
    assert.equal(result.value.isActive, true);
  }

  assert.deepEqual(
    parseSupplierCatalogItemInput({
      targetKind: "other",
      targetId: "milk-id",
      unit: "crate",
      unitPrice: "12.50",
    }),
    { ok: false, status: "invalid_target" },
  );
  assert.deepEqual(
    parseSupplierCatalogItemInput({
      targetKind: "supply",
      targetId: "milk-id",
      unit: "crate",
      unitPrice: "12.501",
    }),
    { ok: false, status: "invalid_price" },
  );
  assert.deepEqual(
    parseSupplierCatalogItemInput({
      targetKind: "supply",
      targetId: "milk-id",
      unit: "crate",
      unitPrice: "10000000000.00",
    }),
    { ok: false, status: "invalid_price" },
  );
});

test("accepts positive quantities and rejects duplicate catalog items", () => {
  const valid = validateSupplierPurchaseOrderRows([
    { catalogItemId: "milk", quantity: "2.5" },
    { catalogItemId: "cups", quantity: "10" },
  ]);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.rows[0].quantity.toString(), "2.5");

  assert.deepEqual(
    validateSupplierPurchaseOrderRows([
      { catalogItemId: "milk", quantity: "1" },
      { catalogItemId: "milk", quantity: "2" },
    ]),
    { ok: false, status: "duplicate_item" },
  );
  assert.deepEqual(validateSupplierPurchaseOrderRows([]), {
    ok: false,
    status: "empty_order",
  });
  assert.deepEqual(
    validateSupplierPurchaseOrderRows([
      { catalogItemId: "milk", quantity: "1000000000" },
    ]),
    { ok: false, status: "invalid_row" },
  );
});

test("rounds each line before summing the purchase-order total", () => {
  assert.equal(
    calculateSupplierPurchaseOrderLineTotal("1.005", "1").toString(),
    "1.01",
  );
  assert.equal(
    calculateSupplierPurchaseOrderTotal([
      { quantity: "1.005", unitPrice: "1" },
      { quantity: "1.005", unitPrice: "1" },
    ]).toString(),
    "2.02",
  );
});

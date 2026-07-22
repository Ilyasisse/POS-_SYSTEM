import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSupplierPurchaseOrderLineTotal,
  calculateSupplierPurchaseOrderTotal,
  canTransitionSupplierPurchaseOrderStatus,
  getSupplierBillDefaultDueDateKey,
  getSupplierCatalogPriceTrend,
  getSupplierPurchaseTodayDateKey,
  getSupplierPurchaseDefaultDeliveryDateKey,
  isSupplierPurchaseDeliveryDateAllowed,
  isValidSupplierPurchaseDateKey,
  parseSupplierCatalogItemInput,
  supplierPurchaseDateKeyToDatabaseDate,
  validateSupplierPurchaseOrderRows,
} from "../../src/lib/suppliers/purchase-orders";
import {
  getSupplierBillDueCutoffDate,
  getSupplierBillDueState,
  summarizeSupplierBillsDue,
} from "../../src/lib/suppliers/supplier-bills";

test("uses Nairobi dates and defaults supplier bills to the next day", () => {
  const now = new Date("2026-07-22T22:30:00.000Z");
  assert.equal(getSupplierPurchaseTodayDateKey(now), "2026-07-23");
  assert.equal(getSupplierBillDefaultDueDateKey(now), "2026-07-24");
  assert.equal(getSupplierPurchaseDefaultDeliveryDateKey(now), "2026-07-24");
});

test("requires purchase-order delivery dates to be today or later in Nairobi", () => {
  const now = new Date("2026-07-22T22:30:00.000Z");
  assert.equal(isSupplierPurchaseDeliveryDateAllowed("2026-07-22", now), false);
  assert.equal(isSupplierPurchaseDeliveryDateAllowed("2026-07-23", now), true);
  assert.equal(isSupplierPurchaseDeliveryDateAllowed("2026-07-24", now), true);
  assert.equal(isSupplierPurchaseDeliveryDateAllowed("not-a-date", now), false);
});

test("classifies supplier bill due dates using Nairobi business dates", () => {
  const now = new Date("2026-07-22T22:30:00.000Z");
  assert.equal(
    getSupplierBillDueCutoffDate(now).toISOString(),
    "2026-07-24T00:00:00.000Z",
  );
  assert.equal(
    getSupplierBillDueState(new Date("2026-07-22T00:00:00.000Z"), now),
    "overdue",
  );
  assert.equal(
    getSupplierBillDueState(new Date("2026-07-23T00:00:00.000Z"), now),
    "today",
  );
  assert.equal(
    getSupplierBillDueState(new Date("2026-07-24T00:00:00.000Z"), now),
    "tomorrow",
  );
  assert.equal(
    getSupplierBillDueState(new Date("2026-07-25T00:00:00.000Z"), now),
    "future",
  );
});

test("groups unpaid supplier balances due through tomorrow", () => {
  const now = new Date("2026-07-22T22:30:00.000Z");
  const summary = summarizeSupplierBillsDue(
    [
      {
        id: "bill-a-overdue",
        supplierId: "supplier-a",
        supplierName: "Alpha Foods",
        dueDate: new Date("2026-07-22T00:00:00.000Z"),
        totalAmount: "100.00",
        paidAmount: "25.00",
        status: "PARTIAL",
      },
      {
        id: "bill-a-tomorrow",
        supplierId: "supplier-a",
        supplierName: "Alpha Foods",
        dueDate: new Date("2026-07-24T00:00:00.000Z"),
        totalAmount: "50.00",
        paidAmount: "0.00",
        status: "UNPAID",
      },
      {
        id: "bill-b-today",
        supplierId: "supplier-b",
        supplierName: "Beta Supplies",
        dueDate: new Date("2026-07-23T00:00:00.000Z"),
        totalAmount: "20.15",
        paidAmount: "0.10",
        status: "UNPAID",
      },
      {
        id: "bill-paid",
        supplierId: "supplier-c",
        supplierName: "Paid Supplier",
        dueDate: new Date("2026-07-22T00:00:00.000Z"),
        totalAmount: "90.00",
        paidAmount: "90.00",
        status: "PAID",
      },
      {
        id: "bill-future",
        supplierId: "supplier-d",
        supplierName: "Future Supplier",
        dueDate: new Date("2026-07-25T00:00:00.000Z"),
        totalAmount: "40.00",
        paidAmount: "0.00",
        status: "UNPAID",
      },
    ],
    now,
  );

  assert.equal(summary.supplierCount, 2);
  assert.equal(summary.billCount, 3);
  assert.equal(summary.totalRemaining, 145.05);
  assert.equal(summary.overdueRemaining, 75);
  assert.equal(summary.dueTodayRemaining, 20.05);
  assert.equal(summary.dueTomorrowRemaining, 50);
  assert.deepEqual(
    summary.suppliers.map((supplier) => supplier.supplierName),
    ["Alpha Foods", "Beta Supplies"],
  );
  assert.equal(summary.suppliers[0].billCount, 2);
  assert.equal(summary.suppliers[0].oldestDueDateKey, "2026-07-22");
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

test("compares the current catalog price with the latest ordered price", () => {
  assert.equal(getSupplierCatalogPriceTrend("10", null), "new");
  assert.equal(getSupplierCatalogPriceTrend("12", "10"), "increased");
  assert.equal(getSupplierCatalogPriceTrend("8", "10"), "decreased");
  assert.equal(getSupplierCatalogPriceTrend("10.00", "10"), "unchanged");
});

test("allows purchase orders to leave OPEN only once", () => {
  assert.equal(
    canTransitionSupplierPurchaseOrderStatus("OPEN", "COMPLETED"),
    true,
  );
  assert.equal(
    canTransitionSupplierPurchaseOrderStatus("OPEN", "CANCELLED"),
    true,
  );
  assert.equal(
    canTransitionSupplierPurchaseOrderStatus("COMPLETED", "CANCELLED"),
    false,
  );
  assert.equal(
    canTransitionSupplierPurchaseOrderStatus("CANCELLED", "COMPLETED"),
    false,
  );
});

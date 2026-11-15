import { expect, test } from "@jest/globals";

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
  expect(getSupplierPurchaseTodayDateKey(now)).toBe("2026-07-23");
  expect(getSupplierBillDefaultDueDateKey(now)).toBe("2026-07-24");
  expect(getSupplierPurchaseDefaultDeliveryDateKey(now)).toBe("2026-07-24");
});

test("requires purchase-order delivery dates to be today or later in Nairobi", () => {
  const now = new Date("2026-07-22T22:30:00.000Z");
  expect(isSupplierPurchaseDeliveryDateAllowed("2026-07-22", now)).toBe(false);
  expect(isSupplierPurchaseDeliveryDateAllowed("2026-07-23", now)).toBe(true);
  expect(isSupplierPurchaseDeliveryDateAllowed("2026-07-24", now)).toBe(true);
  expect(isSupplierPurchaseDeliveryDateAllowed("not-a-date", now)).toBe(false);
});

test("classifies supplier bill due dates using Nairobi business dates", () => {
  const now = new Date("2026-07-22T22:30:00.000Z");
  expect(getSupplierBillDueCutoffDate(now).toISOString()).toBe("2026-07-24T00:00:00.000Z");
  expect(getSupplierBillDueState(new Date("2026-07-22T00:00:00.000Z"), now)).toBe("overdue");
  expect(getSupplierBillDueState(new Date("2026-07-23T00:00:00.000Z"), now)).toBe("today");
  expect(getSupplierBillDueState(new Date("2026-07-24T00:00:00.000Z"), now)).toBe("tomorrow");
  expect(getSupplierBillDueState(new Date("2026-07-25T00:00:00.000Z"), now)).toBe("future");
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

  expect(summary.supplierCount).toBe(2);
  expect(summary.billCount).toBe(3);
  expect(summary.totalRemaining).toBe(145.05);
  expect(summary.overdueRemaining).toBe(75);
  expect(summary.dueTodayRemaining).toBe(20.05);
  expect(summary.dueTomorrowRemaining).toBe(50);
  expect(summary.suppliers.map((supplier) => supplier.supplierName)).toStrictEqual([
    "Alpha Foods",
    "Beta Supplies",
  ]);
  expect(summary.suppliers[0].billCount).toBe(2);
  expect(summary.suppliers[0].oldestDueDateKey).toBe("2026-07-22");
});

test("validates real purchase-order calendar dates", () => {
  expect(isValidSupplierPurchaseDateKey("2026-02-29")).toBe(false);
  expect(isValidSupplierPurchaseDateKey("2028-02-29")).toBe(true);
  expect(supplierPurchaseDateKeyToDatabaseDate("2026-07-22")?.toISOString()).toBe(
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
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.unitPrice.toString()).toBe("12.5");
    expect(result.value.isActive).toBe(true);
  }

  expect(
    parseSupplierCatalogItemInput({
      targetKind: "other",
      targetId: "milk-id",
      unit: "crate",
      unitPrice: "12.50",
    }),
  ).toStrictEqual({ ok: false, status: "invalid_target" });
  expect(
    parseSupplierCatalogItemInput({
      targetKind: "supply",
      targetId: "milk-id",
      unit: "crate",
      unitPrice: "12.501",
    }),
  ).toStrictEqual({ ok: false, status: "invalid_price" });
  expect(
    parseSupplierCatalogItemInput({
      targetKind: "supply",
      targetId: "milk-id",
      unit: "crate",
      unitPrice: "10000000000.00",
    }),
  ).toStrictEqual({ ok: false, status: "invalid_price" });
});

test("accepts positive quantities and rejects duplicate catalog items", () => {
  const valid = validateSupplierPurchaseOrderRows([
    { catalogItemId: "milk", quantity: "2.5" },
    { catalogItemId: "cups", quantity: "10" },
  ]);
  expect(valid.ok).toBe(true);
  if (valid.ok) expect(valid.rows[0].quantity.toString()).toBe("2.5");

  expect(
    validateSupplierPurchaseOrderRows([
      { catalogItemId: "milk", quantity: "1" },
      { catalogItemId: "milk", quantity: "2" },
    ]),
  ).toStrictEqual({ ok: false, status: "duplicate_item" });
  expect(validateSupplierPurchaseOrderRows([])).toStrictEqual({
    ok: false,
    status: "empty_order",
  });
  expect(
    validateSupplierPurchaseOrderRows([{ catalogItemId: "milk", quantity: "1000000000" }]),
  ).toStrictEqual({ ok: false, status: "invalid_row" });
});

test("rounds each line before summing the purchase-order total", () => {
  expect(calculateSupplierPurchaseOrderLineTotal("1.005", "1").toString()).toBe("1.01");
  expect(
    calculateSupplierPurchaseOrderTotal([
      { quantity: "1.005", unitPrice: "1" },
      { quantity: "1.005", unitPrice: "1" },
    ]).toString(),
  ).toBe("2.02");
});

test("compares the current catalog price with the latest ordered price", () => {
  expect(getSupplierCatalogPriceTrend("10", null)).toBe("new");
  expect(getSupplierCatalogPriceTrend("12", "10")).toBe("increased");
  expect(getSupplierCatalogPriceTrend("8", "10")).toBe("decreased");
  expect(getSupplierCatalogPriceTrend("10.00", "10")).toBe("unchanged");
});

test("allows purchase orders to leave OPEN only once", () => {
  expect(canTransitionSupplierPurchaseOrderStatus("OPEN", "COMPLETED")).toBe(true);
  expect(canTransitionSupplierPurchaseOrderStatus("OPEN", "CANCELLED")).toBe(true);
  expect(canTransitionSupplierPurchaseOrderStatus("COMPLETED", "CANCELLED")).toBe(false);
  expect(canTransitionSupplierPurchaseOrderStatus("CANCELLED", "COMPLETED")).toBe(false);
});
